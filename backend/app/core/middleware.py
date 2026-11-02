"""HTTP middlewares: security headers and Origin verification (CSRF defence in depth)."""

import logging

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

from app.core.config import get_settings

logger = logging.getLogger("app.middleware")
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Adds hardening headers to every API response."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Cross-Origin-Resource-Policy", "same-site")
        response.headers.setdefault(
            "Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; sandbox"
        )
        if request.url.path.startswith("/api/"):
            response.headers.setdefault("Cache-Control", "no-store")
        if get_settings().cookie_secure:
            response.headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
        return response


class OriginCheckMiddleware(BaseHTTPMiddleware):
    """Rejects state-changing requests that originate from an untrusted website.

    Browsers always send ``Origin`` on cross-site POST/PUT/PATCH/DELETE, so an
    attacker page cannot forge a request that passes this check.
    """

    async def dispatch(self, request: Request, call_next):
        if request.method not in SAFE_METHODS:
            origin = request.headers.get("origin")
            if origin is not None and origin not in get_settings().frontend_origins:
                logger.warning("Rejected untrusted request origin path=%s", request.url.path)
                return JSONResponse({"error": "Nguồn yêu cầu không được phép."}, status_code=403)
        return await call_next(request)


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Rejects requests whose declared body exceeds the upload limit plus form overhead."""

    async def dispatch(self, request: Request, call_next):
        limit = (get_settings().max_upload_mb + 1) * 1024 * 1024
        declared = request.headers.get("content-length")
        if declared and declared.isdigit() and int(declared) > limit:
            logger.warning("Rejected oversized request path=%s bytes=%s", request.url.path, declared)
            return JSONResponse({"error": "Dữ liệu gửi lên quá lớn."}, status_code=413)
        return await call_next(request)
