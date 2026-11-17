from sqlalchemy import select

from app.db.session import SessionFactory
from app.models.external_news import ExternalNews
from app.services import external_news


async def test_wired_news_endpoint_is_public_and_empty_initially(client):
    response = await client.get("/api/news/wired")

    assert response.status_code == 200
    assert response.json() == {"items": [], "updatedAt": None}


def test_parse_listing_extracts_only_wired_latest_articles():
    articles = "".join(
        f"""
        <li class="summary-item">
          <a href="/story/security-headline-{index}/">
            Wired security headline {index} with a sufficiently long title
            <img src="https://media.wired.com/article-{index}.jpg" alt="Article {index}" />
          </a>
          <p class="summary-item__dek">Summary {index}.</p>
        </li>
        """
        for index in range(1, 7)
    )
    html = """
    <nav>
      <a href="/story/nav-story/">This navigation story must not be included</a>
    </nav>
    <section>
      <h2>Latest</h2>
      <ul>{articles}
        <li><a href="https://example.com/story/outside/">External article must not be included</a></li>
      </ul>
    </section>
    <section>
      <h2>Most Popular</h2>
      <a href="/story/popular-story/">Popular story must not be included</a>
    </section>
    """.format(articles=articles)

    items = external_news.parse_listing(html, "Security", "https://www.wired.com/category/security/")

    assert len(items) == external_news.MAX_NEWS_PER_CATEGORY == 5
    assert items[0].category == "Security"
    assert items[0].title.startswith("Wired security headline 1")
    assert items[0].summary == "Summary 1."
    assert items[0].url == "https://www.wired.com/story/security-headline-1/"
    assert items[0].image_url == "https://media.wired.com/article-1.jpg"
    assert all(item.published_at is None for item in items)


async def test_crawler_caches_up_to_five_latest_articles_per_section(monkeypatch):
    async def fake_fetch_html(_client, url):
        if url in {source for _, source in external_news.SOURCES}:
            category = next(name for name, source in external_news.SOURCES if source == url)
            slug = category.lower().replace(" ", "-")
            anchors = "".join(
                f"""
                <li class="summary-item">
                  <a href="https://www.wired.com/story/{slug}-headline-{index}/">
                    {category} headline {index} with a sufficiently long title
                  </a>
                  <p class="summary-item__dek">Summary {index}.</p>
                </li>
                """
                for index in range(1, 7)
            )
            return f"<html><body><section><h2>Latest</h2><ul>{anchors}</ul></section></body></html>", url

    monkeypatch.setattr(external_news, "_fetch_html", fake_fetch_html)
    async with SessionFactory() as db:
        result = await external_news.crawl_wired(db)
        assert result == {"Security": 5, "Politics": 5, "Big Story": 5}
        rows = (await db.scalars(select(ExternalNews))).all()
        assert len(rows) == 15
        assert all(row.summary for row in rows)
        assert all(row.published_at is None for row in rows)
        assert sorted(row.display_order for row in rows) == list(range(15))
        assert {category: sum(row.category == category for row in rows) for category, _ in external_news.SOURCES} == result

        before = {
            row.url: (row.title, row.fetched_at, row.display_order)
            for row in rows
        }

        def unexpected_shuffle(_items):
            raise AssertionError("An unchanged crawl must preserve the saved shuffle order.")

        monkeypatch.setattr(external_news.random, "shuffle", unexpected_shuffle)
        result = await external_news.crawl_wired(db)
        rows_after = (await db.scalars(select(ExternalNews))).all()

    assert result == {"Security": 0, "Politics": 0, "Big Story": 0}
    assert {
        row.url: (row.title, row.fetched_at, row.display_order)
        for row in rows_after
    } == before


async def test_new_headline_replaces_only_its_section_and_persists_order(monkeypatch):
    new_security_headline = False

    async def fake_fetch_html(_client, url):
        nonlocal new_security_headline
        category = next(name for name, source in external_news.SOURCES if source == url)
        slug = category.lower().replace(" ", "-")
        first_index = 0 if category == "Security" and new_security_headline else 1
        anchors = "".join(
            f"""
            <li class="summary-item">
              <a href="https://www.wired.com/story/{slug}-headline-{index}/">
                {category} headline {index} with a sufficiently long title
              </a>
            </li>
            """
            for index in range(first_index, first_index + 5)
        )
        return f"<section><h2>Latest</h2><ul>{anchors}</ul></section>", url

    monkeypatch.setattr(external_news, "_fetch_html", fake_fetch_html)
    shuffle_calls = 0

    def deterministic_shuffle(items):
        nonlocal shuffle_calls
        shuffle_calls += 1
        items.reverse()

    monkeypatch.setattr(external_news.random, "shuffle", deterministic_shuffle)
    async with SessionFactory() as db:
        first_result = await external_news.crawl_wired(db)
        first_rows = (await db.scalars(select(ExternalNews))).all()
        politics_fetch_time = next(row.fetched_at for row in first_rows if row.category == "Politics")

        new_security_headline = True
        second_result = await external_news.crawl_wired(db)
        second_rows = (await db.scalars(select(ExternalNews))).all()
        page = await external_news.list_wired_news(db)
        page_again = await external_news.list_wired_news(db)

    assert first_result == {"Security": 5, "Politics": 5, "Big Story": 5}
    assert second_result == {"Security": 5, "Politics": 0, "Big Story": 0}
    assert shuffle_calls == 2
    security_urls = {row.url for row in second_rows if row.category == "Security"}
    assert "https://www.wired.com/story/security-headline-0/" in security_urls
    assert "https://www.wired.com/story/security-headline-5/" not in security_urls
    assert next(row.fetched_at for row in second_rows if row.category == "Politics") == politics_fetch_time
    assert [item.url for item in page.items] == [item.url for item in page_again.items]
    assert [item.url for item in page.items] == [
        row.url for row in sorted(second_rows, key=lambda row: row.display_order)
    ]
