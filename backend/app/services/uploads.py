"""Image upload handling: validation, sanitising re-encode and storage."""

import io
import re
import uuid
from pathlib import Path

from fastapi import UploadFile
from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import get_settings
from app.core.errors import AppError

# Reject decompression bombs (pixels, not bytes).
Image.MAX_IMAGE_PIXELS = 25_000_000
MAX_DIMENSION = 2048
ALLOWED_FORMATS = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}
STORED_NAME_PATTERN = re.compile(r"^[0-9a-f]{32}\.(jpg|png|webp)$")


async def read_limited(upload: UploadFile, max_bytes: int) -> bytes:
    """Read the upload in chunks and abort as soon as it exceeds ``max_bytes``."""
    data = bytearray()
    while chunk := await upload.read(64 * 1024):
        data.extend(chunk)
        if len(data) > max_bytes:
            raise AppError(f"Ảnh quá lớn (tối đa {max_bytes // (1024 * 1024)}MB).", 413)
    return bytes(data)


def _sanitize(data: bytes) -> tuple[bytes, str]:
    """Decode with Pillow (content sniffing, not trusting the client MIME) and re-encode.

    Re-encoding strips EXIF/GPS metadata and any payload hidden in the file.
    """
    try:
        with Image.open(io.BytesIO(data)) as probe:
            image_format = probe.format
            if image_format not in ALLOWED_FORMATS:
                raise AppError("Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.", 415)
            image = ImageOps.exif_transpose(probe)
            image.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError):
        raise AppError("Tệp tải lên không phải là ảnh hợp lệ.", 415) from None

    image.thumbnail((MAX_DIMENSION, MAX_DIMENSION))
    output = io.BytesIO()
    if image_format == "JPEG":
        image.convert("RGB").save(output, "JPEG", quality=85, optimize=True)
    elif image_format == "PNG":
        image.save(output, "PNG", optimize=True)
    else:
        image.save(output, "WEBP", quality=85)
    return output.getvalue(), ALLOWED_FORMATS[image_format]


async def save_image(upload: UploadFile) -> str:
    """Validate and store an uploaded image; returns the generated file name."""
    settings = get_settings()
    raw = await read_limited(upload, settings.max_upload_mb * 1024 * 1024)
    if not raw:
        raise AppError("Tệp ảnh trống.", 400)
    content, extension = _sanitize(raw)
    directory = Path(settings.upload_dir)
    directory.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{extension}"
    (directory / name).write_bytes(content)
    return name


def image_path(name: str) -> Path | None:
    """Resolve a stored image name safely (strict whitelist prevents path traversal)."""
    if not STORED_NAME_PATTERN.fullmatch(name):
        return None
    path = Path(get_settings().upload_dir) / name
    return path if path.is_file() else None


def delete_image(name: str | None) -> None:
    if name and STORED_NAME_PATTERN.fullmatch(name):
        (Path(get_settings().upload_dir) / name).unlink(missing_ok=True)
