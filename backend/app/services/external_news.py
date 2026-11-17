"""Polite hourly metadata crawler for selected Wired sections."""

import logging
import random
from dataclasses import dataclass
from datetime import datetime
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup, Tag
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.external_news import ExternalNews
from app.schemas.external_news import ExternalNewsOut, ExternalNewsPage

logger = logging.getLogger("app.external_news")
MAX_HTML_BYTES = 5 * 1024 * 1024
MAX_NEWS_PER_CATEGORY = 5
WIRED_HOSTS = {"wired.com", "www.wired.com"}
SOURCES = (
    ("Security", "https://www.wired.com/category/security/"),
    ("Politics", "https://www.wired.com/category/politics/"),
    ("Big Story", "https://www.wired.com/category/big-story/"),
)
USER_AGENT = "BraveActiveClub/1.0 (hourly headline index)"


@dataclass(frozen=True)
class NewsCandidate:
    category: str
    title: str
    url: str
    summary: str | None
    image_url: str | None
    published_at: datetime | None


def _safe_wired_url(raw_url: str | None, base_url: str) -> str | None:
    if not raw_url:
        return None
    parsed = urlparse(urljoin(base_url, raw_url))
    if parsed.scheme != "https" or parsed.hostname not in WIRED_HOSTS or parsed.username or parsed.password:
        return None
    return parsed._replace(query="", fragment="").geturl()


def _safe_image_url(raw_url: str | None, base_url: str) -> str | None:
    if not raw_url:
        return None
    parsed = urlparse(urljoin(base_url, raw_url))
    host = parsed.hostname or ""
    if (
        parsed.scheme != "https"
        or not (host == "wired.com" or host.endswith(".wired.com"))
        or parsed.username
        or parsed.password
    ):
        return None
    return parsed.geturl()


def parse_listing(html: str, category: str, source_url: str) -> list[NewsCandidate]:
    """Extract headline metadata only from the category page's Latest section."""
    soup = BeautifulSoup(html, "html.parser")
    latest_heading = next(
        (
            heading
            for heading in soup.find_all(["h1", "h2", "h3"])
            if heading.get_text(" ", strip=True).casefold() == "latest"
        ),
        None,
    )
    latest_section = latest_heading.find_parent("section") if latest_heading else None
    if latest_section is None:
        return []

    candidates: list[NewsCandidate] = []
    seen: set[str] = set()

    for anchor in latest_section.select("a[href]"):
        url = _safe_wired_url(anchor.get("href"), source_url)
        if not url:
            continue
        parsed = urlparse(url)
        if not parsed.path.startswith("/story/") or url in seen:
            continue

        title = anchor.get_text(" ", strip=True)
        card = anchor.find_parent(class_="summary-item") or anchor
        if not title:
            image = card.find("img")
            title = str(image.get("alt", "")).strip() if image else ""
        if len(title) < 12:
            continue

        title = title[:500]
        summary_node = card.select_one(".summary-item__dek, [data-testid='SummaryItemDek']")
        summary = summary_node.get_text(" ", strip=True)[:500] if summary_node else None
        image_node = card.find("img")
        image_url = None
        if image_node:
            image_url = _safe_image_url(
                image_node.get("data-src") or image_node.get("src"),
                source_url,
            )

        candidates.append(NewsCandidate(category, title, url, summary, image_url, None))
        seen.add(url)
        if len(candidates) >= MAX_NEWS_PER_CATEGORY:
            break
    return candidates


async def _fetch_html(client: httpx.AsyncClient, url: str) -> tuple[str, str]:
    async with client.stream("GET", url) as response:
        response.raise_for_status()
        final_url = str(response.url)
        if urlparse(final_url).hostname not in WIRED_HOSTS:
            raise ValueError("Wired redirected outside its approved host.")
        content_type = response.headers.get("content-type", "")
        if "text/html" not in content_type.lower():
            raise ValueError("Wired returned a non-HTML page.")
        chunks: list[bytes] = []
        size = 0
        async for chunk in response.aiter_bytes():
            size += len(chunk)
            if size > MAX_HTML_BYTES:
                raise ValueError("Wired page exceeded the crawler size limit.")
            chunks.append(chunk)
    return b"".join(chunks).decode("utf-8", errors="replace"), final_url


async def crawl_wired(db: AsyncSession) -> dict[str, int]:
    """Replace a section cache only when its Latest list contains a new article."""
    timeout = httpx.Timeout(12.0, connect=5.0)
    headers = {"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"}
    successful: dict[str, list[NewsCandidate]] = {}
    async with httpx.AsyncClient(
        timeout=timeout,
        headers=headers,
        follow_redirects=True,
        max_redirects=3,
    ) as client:
        for category, source_url in SOURCES:
            try:
                html, page_url = await _fetch_html(client, source_url)
                candidates = parse_listing(html, category, page_url)
                if not candidates:
                    raise ValueError("No article links were found in the Wired Latest section.")
                successful[category] = candidates[:MAX_NEWS_PER_CATEGORY]
            except (httpx.HTTPError, ValueError):
                logger.exception("Could not crawl Wired section %s", category)

    cached_rows = (await db.execute(select(ExternalNews.url, ExternalNews.category))).all()
    cached_urls: dict[str, set[str]] = {}
    for url, category in cached_rows:
        cached_urls.setdefault(category, set()).add(url)

    updated: dict[str, int] = {}
    for category, articles in successful.items():
        article_urls = {article.url for article in articles}
        if not article_urls.difference(cached_urls.get(category, set())):
            updated[category] = 0
            logger.info("Wired section %s is unchanged; keeping its cached headlines.", category)
            continue

        await db.execute(delete(ExternalNews).where(ExternalNews.category == category))
        db.add_all(
            ExternalNews(
                url=article.url,
                category=article.category,
                title=article.title,
                summary=article.summary,
                image_url=article.image_url,
                published_at=None,
            )
            for article in articles
        )
        updated[category] = len(articles)

    if any(updated.values()):
        await db.flush()
        all_rows = (await db.scalars(select(ExternalNews))).all()
        random.shuffle(all_rows)
        for position, row in enumerate(all_rows):
            row.display_order = position
        await db.commit()
        logger.info("Wired headlines changed; replaced sections and persisted a new display order.")
    return updated


async def list_wired_news(db: AsyncSession) -> ExternalNewsPage:
    rows = (
        await db.scalars(
            select(ExternalNews).order_by(ExternalNews.display_order, ExternalNews.url)
        )
    ).all()
    items = [ExternalNewsOut.model_validate(row) for row in rows]
    updated_at = max((item.fetched_at for item in items), default=None)
    return ExternalNewsPage(items=items, updated_at=updated_at)
