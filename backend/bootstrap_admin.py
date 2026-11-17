"""Create the first administrator once; prompt securely instead of storing credentials."""

import asyncio
import getpass

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionFactory, engine
from app.models import User
from app.schemas.auth import validate_password_strength

ADMIN_EMAIL = "admin@bravesoft.com.vn"


async def main() -> None:
    async with SessionFactory() as db:
        existing = await db.scalar(select(User).where(User.email == ADMIN_EMAIL))
        if existing:
            if existing.role != "admin" or not existing.is_active:
                raise SystemExit("Bootstrap email already exists but is not an active administrator.")
            print("Bootstrap administrator already exists; no changes made.")
            return
        if await db.scalar(select(User.id).where(User.role == "admin", User.is_active)):
            raise SystemExit("An administrator already exists; bootstrap is disabled.")
        password = getpass.getpass(f"Initial password for {ADMIN_EMAIL}: ")
        if password != getpass.getpass("Confirm password: "):
            raise SystemExit("Passwords do not match.")
        try:
            validate_password_strength(password)
        except ValueError as exc:
            raise SystemExit(str(exc)) from exc
        db.add(User(email=ADMIN_EMAIL, display_name="Admin", role="admin",
                    password_hash=hash_password(password), must_change_password=True))
        await db.commit()
        print("Administrator created. Change the password on first login.")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
