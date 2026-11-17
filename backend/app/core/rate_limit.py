"""Small in-memory sliding-window rate limiter.

Suitable for a single backend process. Multi-replica deployments need a shared
rate-limit store before scaling beyond one worker.
"""

import time
from collections import defaultdict, deque

from fastapi import Request

from app.core.config import get_settings
from app.core.errors import AppError


def client_ip(request: Request) -> str:
    """Best-effort client IP; X-Forwarded-For is trusted only when explicitly enabled."""
    if get_settings().trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._last_cleanup = time.monotonic()

    def hit(self, key: str, limit: int, window_seconds: int) -> int | None:
        """Register a hit. Returns ``None`` if allowed, else seconds until retry."""
        now = time.monotonic()
        self._cleanup(now)
        bucket = self._hits[key]
        while bucket and bucket[0] <= now - window_seconds:
            bucket.popleft()
        if len(bucket) >= limit:
            return max(1, int(bucket[0] + window_seconds - now) + 1)
        bucket.append(now)
        return None

    def reset(self) -> None:
        self._hits.clear()

    def _cleanup(self, now: float) -> None:
        # Drop idle keys now and then so memory does not grow unbounded.
        if now - self._last_cleanup < 300:
            return
        self._last_cleanup = now
        for key in [k for k, v in self._hits.items() if not v or v[-1] < now - 3600]:
            del self._hits[key]


limiter = RateLimiter()


def rate_limit(name: str, limit: int, window_seconds: int):
    """FastAPI dependency factory: ``Depends(rate_limit("login", 10, 60))``."""

    async def dependency(request: Request) -> None:
        retry_after = limiter.hit(f"{name}:{client_ip(request)}", limit, window_seconds)
        if retry_after is not None:
            raise AppError(
                "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.",
                429,
                headers={"Retry-After": str(retry_after)},
            )

    return dependency


def enforce_limit(key: str, limit: int, window_seconds: int) -> None:
    """Imperative variant for per-user limits, e.g. ``enforce_limit(f"post:{user.id}", 20, 3600)``."""
    retry_after = limiter.hit(key, limit, window_seconds)
    if retry_after is not None:
        raise AppError(
            "Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.",
            429,
            headers={"Retry-After": str(retry_after)},
        )
