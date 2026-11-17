from unittest.mock import AsyncMock

from app.services import link_preview
from app.services.link_preview import extract_first_url, normalize_url, parse_preview
from app.core.errors import AppError

import pytest


def test_extract_first_url_trims_punctuation():
    assert extract_first_url("xem https://example.com/a?b=1, nhé") == "https://example.com/a?b=1"
    assert extract_first_url("không có link") is None


def test_parse_preview_prefers_open_graph_and_resolves_relative_image():
    html = (
        '<html><head><title>Fallback</title>'
        '<meta property="og:title" content="OG Title">'
        '<meta property="og:image" content="/img/cover.png">'
        '<meta name="description" content="Desc"></head></html>'
    )
    preview = parse_preview("https://example.com/post", html)
    assert preview.title == "OG Title"
    assert preview.image == "https://example.com/img/cover.png"
    assert preview.description == "Desc"
    assert preview.site == "example.com"


def test_parse_preview_drops_non_http_images():
    html = '<meta property="og:image" content="javascript:alert(1)">'
    assert parse_preview("https://example.com", html).image is None


@pytest.mark.parametrize("url", ["file:///etc/passwd", "http://user:pass@example.com", "https://example.com:8443/x"])
def test_normalize_url_rejects_unsafe(url):
    with pytest.raises(AppError):
        normalize_url(url)


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("https://www.youtube.com/watch?v=dNuI6ViswoE&list=PL123", "dNuI6ViswoE"),
        ("https://youtu.be/dNuI6ViswoE?t=30", "dNuI6ViswoE"),
        ("https://www.youtube.com/shorts/dNuI6ViswoE", "dNuI6ViswoE"),
        ("https://example.com/watch?v=dNuI6ViswoE", None),
        ("https://www.youtube.com/watch?v=invalid", None),
    ],
)
def test_youtube_video_id(url, expected):
    assert link_preview._youtube_video_id(url) == expected


@pytest.mark.asyncio
async def test_youtube_preview_uses_oembed_metadata(monkeypatch):
    url = "https://www.youtube.com/watch?v=dNuI6ViswoE&list=PL123"
    monkeypatch.setattr(link_preview, "_fetch_youtube_oembed", AsyncMock(return_value=("Video title", "Brave Active")))
    link_preview._cache.clear()

    preview = await link_preview.get_link_preview(url)

    assert preview.title == "Video title"
    assert preview.description == "Brave Active"
    assert preview.image == "https://i.ytimg.com/vi/dNuI6ViswoE/hqdefault.jpg"
    assert preview.site == "YouTube"
