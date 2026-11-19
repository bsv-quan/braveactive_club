"""Run the one-time AI location backfill for existing activities."""

import asyncio

from app.db.session import SessionFactory, engine
from app.services.activity_location_migration import backfill_activity_locations


async def main() -> None:
    try:
        async with SessionFactory() as db:
            processed, with_location = await backfill_activity_locations(db)
        print(
            f"Checked {processed} activities; "
            f"found map locations for {with_location}."
        )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
