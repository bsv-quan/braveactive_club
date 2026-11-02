"""Cryptographic helpers: password hashing, opaque tokens, CSRF tokens."""

import hashlib
import hmac
import secrets

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError

from app.core.config import get_settings

_hasher = PasswordHasher()
# Hash used to burn the same CPU time when the account does not exist (timing side channel).
_DUMMY_HASH = _hasher.hash("dummy-password-for-timing")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    """Constant-effort verification; pass ``None`` when the user does not exist."""
    try:
        return _hasher.verify(password_hash or _DUMMY_HASH, password) and password_hash is not None
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def needs_rehash(password_hash: str) -> bool:
    return _hasher.check_needs_rehash(password_hash)


def new_token() -> str:
    """Return a 256-bit URL-safe random token (given to the client, never stored raw)."""
    return secrets.token_urlsafe(32)


def hash_token(token: str) -> str:
    """Tokens are stored as SHA-256 digests so a DB leak does not expose live sessions."""
    return hashlib.sha256(token.encode()).hexdigest()


def csrf_token_for(session_token: str) -> str:
    """Derive a CSRF token bound to the session (HMAC with the server secret)."""
    key = get_settings().secret_key.encode()
    return hmac.new(key, f"csrf:{session_token}".encode(), hashlib.sha256).hexdigest()


def safe_equals(a: str, b: str) -> bool:
    return hmac.compare_digest(a.encode(), b.encode())
