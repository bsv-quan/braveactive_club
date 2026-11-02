"""Link preview (Open Graph) fetching with SSRF protection.

User supplied URLs are fetched server side, so every hop is validated:
* only http/https on ports 80/443, no embedded credentials;
* the hostname is resolved by *our* network backend and the connection is pinned to a
  public IP (blocks private/loopback/link-local ranges and DNS rebinding);
* redirects are followed manually (max 3) and re-validated;
* response size and time are capped, and only HTML is parsed.
"""

import asyncio
import ipaddress
import re
import socket
import time
from dataclasses import dataclass
from urllib.parse import urljoin, urlparse

import httpcore
import httpx
from bs4 import BeautifulSoup

from app.core.errors import AppError

MAX_BYTES = 512 * 1024
MAX_REDIRECTS = 3
TIMEOUT_SECONDS = 5
CACHE_TTL_SECONDS = 600
ALLOWED_PORTS = {80, 443, None}
URL_PATTERN = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)


@dataclass
class LinkPreview:
    url: str
    title: str | None = None
    description: str | None = None
    image: str | None = None
    site: str | None = None


def extract_first_url(text: str) -> str | None:
    """Return the first http(s) URL found in free text (trailing punctuation trimmed)."""
    match = URL_PATTERN.search(text)
    return match.group(0).rstrip(".,;:!?)]}") if match else None


def normalize_url(raw: str) -> str:
    """Validate the URL shape and return a clean string; raise ``AppError`` when unsafe."""
    raw = raw.strip()
    if len(raw) > 2048:
        raise AppError("Đường dẫn quá dài.", 400)
    parsed = urlparse(raw)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise AppError("Chỉ hỗ trợ đường dẫn http hoặc https.", 400)
    if parsed.username or parsed.password:
        raise AppError("Đường dẫn không được chứa thông tin đăng nhập.", 400)
    try:
        port = parsed.port
    except ValueError:
        raise AppError("Đường dẫn không hợp lệ.", 400) from None
    if port not in ALLOWED_PORTS:
        raise AppError("Cổng của đường dẫn không được hỗ trợ.", 400)
    return parsed.geturl()


def _is_public_ip(address: str) -> bool:
    ip = ipaddress.ip_address(address)
    return ip.is_global and not ip.is_multicast


async def resolve_public_ip(host: str) -> str:
    """Resolve ``host`` and return one public IP, or raise if any record is non-public."""
    try:
        infos = await asyncio.get_running_loop().getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except socket.gaierror:
        raise AppError("Không thể truy cập đường dẫn này.", 400) from None
    addresses = [info[4][0].split("%")[0] for info in infos]
    if not addresses or not all(_is_public_ip(address) for address in addresses):
        raise AppError("Đường dẫn này không được phép truy cập.", 400)
    return addresses[0]


class _PinnedBackend(httpcore.AnyIOBackend):
    """Connects only to validated public IPs (resolution + connect are one atomic step)."""

    async def connect_tcp(self, host, port, timeout=None, local_address=None, socket_options=None):
        ip = await resolve_public_ip(host)
        return await super().connect_tcp(ip, port, timeout, local_address, socket_options)


def _build_transport() -> httpx.AsyncHTTPTransport:
    transport = httpx.AsyncHTTPTransport()
    # httpx exposes no public hook for the network backend; replace the pool's backend.
    transport._pool._network_backend = _PinnedBackend()  # noqa: SLF001
    return transport


async def _fetch_html(url: str) -> tuple[str, str]:
    """Fetch up to MAX_BYTES of an HTML page; returns (final_url, html)."""
    headers = {
        "User-Agent": "BraveActiveLinkPreview/1.0",
        "Accept": "text/html,application/xhtml+xml",
    }
    async with httpx.AsyncClient(
        transport=_build_transport(), timeout=TIMEOUT_SECONDS, follow_redirects=False, headers=headers
    ) as client:
        current = normalize_url(url)
        for _ in range(MAX_REDIRECTS + 1):
            async with client.stream("GET", current) as response:
                if response.is_redirect and (location := response.headers.get("location")):
                    current = normalize_url(urljoin(current, location))
                    continue
                if response.status_code >= 400:
                    raise AppError("Không thể tải thông tin trang web này.", 400)
                content_type = response.headers.get("content-type", "")
                if "html" not in content_type.lower():
                    raise AppError("Đường dẫn này không phải là trang web.", 400)
                chunks: list[bytes] = []
                total = 0
                async for chunk in response.aiter_bytes():
                    chunks.append(chunk)
                    total += len(chunk)
                    if total >= MAX_BYTES:
                        break
                body = b"".join(chunks)[:MAX_BYTES]
                return current, body.decode(response.encoding or "utf-8", errors="replace")
    raise AppError("Đường dẫn chuyển hướng quá nhiều lần.", 400)


def _meta(soup: BeautifulSoup, *names: str) -> str | None:
    for name in names:
        tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
        content = tag.get("content") if tag else None
        if isinstance(content, str) and content.strip():
            return content.strip()
    return None


def parse_preview(final_url: str, html: str) -> LinkPreview:
    """Extract Open Graph / Twitter / basic metadata from an HTML document."""
    soup = BeautifulSoup(html, "html.parser")
    title = _meta(soup, "og:title", "twitter:title") or (
        soup.title.string.strip() if soup.title and soup.title.string else None
    )
    description = _meta(soup, "og:description", "twitter:description", "description")
    image = _meta(soup, "og:image", "twitter:image")
    site = _meta(soup, "og:site_name") or urlparse(final_url).hostname

    if image:
        image = urljoin(final_url, image)
        # Thumbnails are loaded by the visitor's browser; allow only http(s) images.
        if urlparse(image).scheme not in {"http", "https"} or len(image) > 2048:
            image = None

    return LinkPreview(
        url=final_url,
        title=(title or None) and title[:300],
        description=(description or None) and description[:600],
        image=image,
        site=(site or None) and site[:120],
    )


_cache: dict[str, tuple[float, LinkPreview]] = {}


async def get_link_preview(url: str) -> LinkPreview:
    """Cached preview lookup used by both the composer and post creation."""
    key = normalize_url(url)
    now = time.monotonic()
    cached = _cache.get(key)
    if cached and now - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]

    try:
        final_url, html = await _fetch_html(key)
    except httpx.HTTPError:
        raise AppError("Không thể tải thông tin trang web này.", 400) from None
    preview = parse_preview(final_url, html)
    if len(_cache) > 500:
        _cache.clear()
    _cache[key] = (now, preview)
    return preview
