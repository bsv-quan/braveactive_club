"""Application settings loaded from environment variables (or backend/.env)."""

from functools import lru_cache
from pathlib import Path
from typing import Annotated

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

INSECURE_DEFAULT_SECRET = "dev-only-insecure-secret-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: str = "development"  # "development" | "production"

    # --- Database ---
    database_url: str = "postgresql+asyncpg://braveactive:braveactive@localhost:5432/braveactive"

    # --- Security ---
    secret_key: str = INSECURE_DEFAULT_SECRET
    # Origins allowed to call the API from a browser (CORS + Origin check + WebSocket).
    frontend_origins: Annotated[list[str], NoDecode] = ["http://localhost:3000"]
    # Public base URL of the frontend, used to build links inside emails.
    frontend_base_url: str = "http://localhost:3000"
    cookie_secure: bool = False  # Must be True behind HTTPS (production).
    session_ttl_days: int = 7
    password_reset_ttl_minutes: int = 30
    # Only enable when running behind a trusted reverse proxy that sets X-Forwarded-For.
    trust_proxy_headers: bool = False
    admin_emails: Annotated[list[str], NoDecode] = []
    cron_secret: str = ""

    # --- Mail (Gmail SMTP: smtp.gmail.com:587 + an app password) ---
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_use_starttls: bool = True
    mail_from: str = ""

    # --- Uploads ---
    upload_dir: Path = Path("uploads")
    max_upload_mb: int = 5

    @field_validator("frontend_origins", "admin_emails", mode="before")
    @classmethod
    def split_csv(cls, value):
        """Allow comma separated values in .env files."""
        if isinstance(value, str) and not value.strip().startswith("["):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @property
    def mail_enabled(self) -> bool:
        return bool(self.smtp_host and self.smtp_user and self.smtp_password)

    def validate_for_runtime(self) -> None:
        """Refuse to boot in production with unsafe defaults."""
        if self.is_production:
            if self.secret_key == INSECURE_DEFAULT_SECRET or len(self.secret_key) < 32:
                raise RuntimeError("SECRET_KEY must be set to a random value (>= 32 chars) in production.")
            if not self.cookie_secure:
                raise RuntimeError("COOKIE_SECURE must be true in production (HTTPS only).")


@lru_cache
def get_settings() -> Settings:
    return Settings()
