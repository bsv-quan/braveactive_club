"""Domain error type and global exception handlers.

All API errors are returned as ``{"error": "<message>"}`` so the frontend has a single
shape to handle.
"""

import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("app.errors")


class AppError(Exception):
    """Raised by services/routes to return a user-facing error message."""

    def __init__(self, message: str, status_code: int = 400, headers: dict[str, str] | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.headers = headers


def error_response(message: str, status_code: int, headers: dict[str, str] | None = None) -> JSONResponse:
    return JSONResponse({"error": message}, status_code=status_code, headers=headers)


def register_exception_handlers(app: FastAPI) -> None:
    """Log handled failures without recording request bodies or user credentials."""
    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError):
        logger.warning("Handled application error status=%s path=%s", exc.status_code, request.url.path)
        return error_response(exc.message, exc.status_code, exc.headers)

    @app.exception_handler(StarletteHTTPException)
    async def handle_http_error(request: Request, exc: StarletteHTTPException):
        message = exc.detail if isinstance(exc.detail, str) else "Yêu cầu không hợp lệ."
        logger.warning("Handled HTTP error status=%s path=%s", exc.status_code, request.url.path)
        return error_response(message, exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def handle_validation_error(request: Request, exc: RequestValidationError):
        # Never echo raw input back; only surface the failing field names.
        fields = sorted({str(err["loc"][-1]) for err in exc.errors() if err.get("loc")})
        suffix = f" ({', '.join(fields)})" if fields else ""
        logger.warning("Request validation failed path=%s fields=%s", request.url.path, fields)
        return error_response(f"Dữ liệu gửi lên không hợp lệ{suffix}.", 400)

    @app.exception_handler(Exception)
    async def handle_unexpected(_: Request, exc: Exception):
        import logging

        logging.getLogger("app").exception("Unhandled error", exc_info=exc)
        return error_response("Máy chủ gặp lỗi. Vui lòng thử lại sau.", 500)
