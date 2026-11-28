import json
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, Mock

import pytest
from pydantic import ValidationError
from sqlalchemy import select

from app.core.errors import AppError
from app.core.config import get_settings
from app.db.session import SessionFactory
from app.models import User
from app.schemas.ai_content import WordSearchPuzzle, WordSearchRequest
from app.services import ai_content
from tests.conftest import register


SOURCE_URL = "https://www.who.int/news/item/2026-01-01-health-information"
ARTICLE = {
    "title": "Thông tin sức khỏe đáng tin cậy",
    "content": (
        "Tổ chức Y tế Thế giới vừa công bố thông tin cập nhật về sức khỏe cộng đồng. "
        "Bài viết trình bày dữ kiện chính, giải thích bối cảnh và nêu những điểm người đọc "
        "có thể tham khảo trong sinh hoạt hằng ngày. Nội dung chỉ nhằm cung cấp kiến thức "
        "chung và khuyến khích người đọc tìm hiểu thêm từ nguồn chính thức."
    ),
}


def article_response(article=ARTICLE):
    return {
        "output": [{
            "type": "message",
            "content": [{"type": "output_text", "text": json.dumps(article, ensure_ascii=False)}],
        }]
    }


def candidate(url=SOURCE_URL, published_at=None):
    return ai_content.RSSCandidate(
        topic="health",
        title="World Health Organization article",
        url=url,
        description="A trusted public health update.",
        published_at=published_at or datetime.now(timezone.utc),
        source_domain="www.who.int",
    )


async def test_detect_activity_location_uses_structured_ai_output(monkeypatch):
    location = "Nhà văn hóa Thanh Niên, TP. Hồ Chí Minh"
    request = AsyncMock(return_value=article_response({"location": location}))
    monkeypatch.setattr(ai_content, "_request_response", request)

    detected = await ai_content.detect_activity_location(
        "Giao lưu cầu lông",
        "Gặp nhau tại Nhà văn hóa Thanh Niên, TP. Hồ Chí Minh.",
    )

    assert detected == location
    request.assert_awaited_once()
    request_args = request.await_args.kwargs
    assert request_args["schema_name"] == "activity_location"
    assert request_args["json_schema"]["required"] == ["location"]
    assert request_args["json_schema"]["additionalProperties"] is False


async def test_detect_post_category_uses_structured_ai_output_and_fallback(monkeypatch):
    request = AsyncMock(return_value=article_response({"category": "culture"}))
    monkeypatch.setattr(ai_content, "_request_response", request)

    detected = await ai_content.detect_post_category(
        "Triển lãm di sản văn hoá truyền thống tại bảo tàng mỹ thuật.",
        link_url="https://vnexpress.net/giai-tri/trien-lam-di-san.html",
        link_site="vnexpress.net",
    )

    assert detected == "culture"
    request.assert_awaited_once()
    request_args = request.await_args.kwargs
    assert request_args["schema_name"] == "post_category"
    assert request_args["json_schema"]["properties"]["category"]["enum"] == [
        "culture",
        "society",
        "entertainment",
        "lifestyle",
        "sports",
        "technology",
    ]
    assert request_args["json_schema"]["additionalProperties"] is False

    assert (
        ai_content.infer_post_category_fallback(
            "Bản tin AI mới nhất",
            link_url="https://techcrunch.com/2026/11/28/ai-news/",
            link_site="techcrunch.com",
        )
        == "technology"
    )
    assert (
        ai_content.infer_post_category_fallback(
            "Giao lưu cầu lông tối thứ Sáu",
            activity_category="CẦU LÔNG",
        )
        == "sports"
    )
    assert (
        ai_content.infer_post_category_fallback(
            "Đi bộ gây quỹ từ thiện mùa đông",
            activity_category="TỪ THIỆN",
        )
        == "society"
    )


async def test_word_search_generation_validates_and_places_words_in_multiple_directions(monkeypatch):
    generated_words = [
        {"answer": "WARM UP", "display_answer": "Warm up", "clue": "What gentle movements prepare the body for exercise?"},
        {"answer": "SIT UPS", "display_answer": "Sit ups", "clue": "Which exercise strengthens the abdominal muscles?"},
        {"answer": "GYM DAY", "display_answer": "Gym day", "clue": "What is a scheduled day for exercise called?"},
        {"answer": "GO FAST", "display_answer": "Go fast", "clue": "What should a sprinter do to increase speed?"},
        {"answer": "BOX OUT", "display_answer": "Box out", "clue": "What basketball move helps secure a rebound?"},
    ]
    request = AsyncMock(return_value=article_response({"words": generated_words}))
    monkeypatch.setattr(ai_content, "_request_response", request)
    monkeypatch.setattr(ai_content.random, "randint", lambda minimum, maximum: 5)

    puzzle = await ai_content.generate_word_search(
        WordSearchRequest(difficulty="hard", locale="en")
    )

    assert puzzle.size == ai_content._word_search_grid_size([len(word["answer"].replace(" ", "")) for word in generated_words])
    assert len(puzzle.grid) == puzzle.size
    assert all(len(row) == puzzle.size for row in puzzle.grid)
    assert [word.answer for word in puzzle.words] == [
        word["answer"].replace(" ", "") for word in generated_words
    ]
    assert [word.display_answer for word in puzzle.words] == [
        word["display_answer"] for word in generated_words
    ]
    request.assert_awaited_once()
    assert request.await_args.kwargs["schema_name"] == "word_search"
    assert request.await_args.kwargs["json_schema"]["properties"]["words"]["minItems"] == 5
    assert request.await_args.kwargs["json_schema"]["properties"]["words"]["maxItems"] == 5

    found_orientations = set()
    directions = ((0, 1, "horizontal"), (1, 0, "vertical"), (1, 1, "diagonal"), (1, -1, "diagonal"))
    for word in puzzle.words:
        found = False
        for row in range(puzzle.size):
            for column in range(puzzle.size):
                for row_step, column_step, orientation in directions:
                    end_row = row + (len(word.answer) - 1) * row_step
                    end_column = column + (len(word.answer) - 1) * column_step
                    if not (0 <= end_row < puzzle.size and 0 <= end_column < puzzle.size):
                        continue
                    selected = "".join(
                        puzzle.grid[row + index * row_step][column + index * column_step]
                        for index in range(len(word.answer))
                    )
                    if selected == word.answer:
                        found_orientations.add(orientation)
                        found = True
                        break
                if found:
                    break
            if found:
                break
        assert found, f"{word.answer} was not placed on the board"
    assert {"horizontal", "vertical", "diagonal"} <= found_orientations


async def test_word_search_generation_rejects_model_output_that_does_not_match_request(monkeypatch):
    request = AsyncMock(return_value=article_response({
        "words": [{
            "answer": "HEALTH",
            "display_answer": "Health",
            "clue": "What describes a complete answer as one word?",
        }]
        * 5,
    }))
    monkeypatch.setattr(ai_content, "_request_response", request)
    monkeypatch.setattr(ai_content.random, "randint", lambda minimum, maximum: 5)

    with pytest.raises(AppError) as error:
        await ai_content.generate_word_search(
            WordSearchRequest(difficulty="hard", locale="en")
        )
    assert error.value.status_code == 502


async def test_word_search_generation_uses_random_count_and_natural_answer_lengths(monkeypatch):
    generated_words = [
        {"answer": "BONG", "display_answer": "Bóng", "clue": "Vật hình cầu được ném vào rổ trong môn bóng rổ là gì?"},
        {"answer": "CHAY", "display_answer": "Chạy", "clue": "Hoạt động di chuyển nhanh bằng chân được gọi là gì?"},
        {"answer": "CHAY BO", "display_answer": "Chạy bộ", "clue": "Hoạt động nào giúp rèn luyện sức bền bằng cách di chuyển nhanh bằng chân?"},
    ]
    request = AsyncMock(return_value=article_response({"words": generated_words}))
    monkeypatch.setattr(ai_content, "_request_response", request)
    monkeypatch.setattr(ai_content.random, "randint", lambda minimum, maximum: 3)
    puzzle = await ai_content.generate_word_search(WordSearchRequest(difficulty="easy", locale="vi"))

    assert len(puzzle.words) == 3
    assert puzzle.size == ai_content._word_search_grid_size([4, 4, 6])
    assert request.await_args.kwargs["json_schema"]["properties"]["words"]["minItems"] == 3
    assert request.await_args.kwargs["json_schema"]["properties"]["words"]["maxItems"] == 3
    assert "exactly 3 distinct" in request.await_args.args[0]
    assert "one clear, concise question as the clue" in request.await_args.args[0]
    assert "never misspell, truncate, abbreviate" in request.await_args.args[0]
    assert "Avoid vague prompts" in request.await_args.args[0]
    assert "easy" in request.await_args.args[0]
    assert "do not make all answers the same length" in request.await_args.args[0]


@pytest.mark.parametrize(
    ("difficulty", "question_count"),
    [("easy", 5), ("medium", 3), ("hard", 4)],
)
async def test_word_search_question_count_is_random_independent_of_difficulty(
    monkeypatch, difficulty, question_count
):
    generated_words = [
        {
            "answer": f"WORD{chr(65 + index)}",
            "display_answer": f"Word{chr(65 + index)}",
            "clue": f"What is the name of word number {index + 1}?",
        }
        for index in range(question_count)
    ]
    request = AsyncMock(return_value=article_response({"words": generated_words}))
    monkeypatch.setattr(ai_content, "_request_response", request)
    random_count = Mock(return_value=question_count)
    monkeypatch.setattr(ai_content.random, "randint", random_count)

    puzzle = await ai_content.generate_word_search(
        WordSearchRequest(difficulty=difficulty, locale="en")
    )

    assert len(puzzle.words) == question_count
    random_count.assert_called_once_with(3, 5)
    words_schema = request.await_args.kwargs["json_schema"]["properties"]["words"]
    assert words_schema["minItems"] == question_count
    assert words_schema["maxItems"] == question_count
    assert f"exactly {question_count} distinct" in request.await_args.args[0]


async def test_word_search_retries_once_when_ai_output_fails_validation(monkeypatch):
    invalid_words = [
        {"answer": "BOI", "display_answer": "Bơi", "clue": "Hoạt động di chuyển trong nước là gì?"},
        {"answer": "CHAY", "display_answer": "Chạy", "clue": "Hoạt động di chuyển nhanh bằng chân?"},
        {"answer": "NHAY", "display_answer": "Nhảy", "clue": "Động tác bật người rời khỏi mặt đất?"},
    ]
    valid_words = [
        {"answer": "BONG", "display_answer": "Bóng", "clue": "Vật hình cầu được ném vào rổ trong môn bóng rổ là gì?"},
        {"answer": "CHAY", "display_answer": "Chạy", "clue": "Hoạt động di chuyển nhanh bằng chân được gọi là gì?"},
        {"answer": "NHAY", "display_answer": "Nhảy", "clue": "Động tác bật người rời khỏi mặt đất được gọi là gì?"},
    ]
    request = AsyncMock(side_effect=[
        article_response({"words": invalid_words}),
        article_response({"words": valid_words}),
    ])
    monkeypatch.setattr(ai_content, "_request_response", request)
    monkeypatch.setattr(ai_content.random, "randint", lambda minimum, maximum: 3)

    puzzle = await ai_content.generate_word_search(
        WordSearchRequest(difficulty="easy", locale="vi")
    )

    assert len(puzzle.words) == 3
    assert request.await_count == 2
    assert "previous response did not pass validation" in request.await_args.args[0]
    assert "4 to 16 letters" in request.await_args.args[0]


async def test_word_search_generation_rejects_answer_shorter_than_four_letters(monkeypatch):
    generated_words = [
        {"answer": "RUN", "display_answer": "Run", "clue": "What is the English word for moving quickly on foot?"},
        {"answer": "CHAY", "display_answer": "Chạy", "clue": "Hoạt động di chuyển nhanh bằng chân được gọi là gì?"},
        {"answer": "BONG", "display_answer": "Bóng", "clue": "Vật hình cầu được ném vào rổ trong môn bóng rổ là gì?"},
    ]
    request = AsyncMock(return_value=article_response({"words": generated_words}))
    monkeypatch.setattr(ai_content, "_request_response", request)
    monkeypatch.setattr(ai_content.random, "randint", lambda minimum, maximum: 3)

    with pytest.raises(AppError) as error:
        await ai_content.generate_word_search(WordSearchRequest(difficulty="easy", locale="vi"))
    assert error.value.status_code == 502


async def test_word_search_allows_natural_single_word_answers(monkeypatch):
    generated_words = [
        {"display_answer": "Bóng", "clue": "Vật hình cầu được ném vào rổ trong môn bóng rổ là gì?"},
        {"display_answer": "Chạy", "clue": "Hoạt động di chuyển nhanh bằng chân được gọi là gì?"},
        {"display_answer": "Nhảy", "clue": "Động tác bật người rời khỏi mặt đất được gọi là gì?"},
    ]
    request = AsyncMock(return_value=article_response({"words": generated_words}))
    monkeypatch.setattr(ai_content, "_request_response", request)
    monkeypatch.setattr(ai_content.random, "randint", lambda minimum, maximum: 3)

    puzzle = await ai_content.generate_word_search(
        WordSearchRequest(difficulty="easy", locale="vi")
    )

    assert [word.answer for word in puzzle.words] == ["BONG", "CHAY", "NHAY"]
    assert [word.display_answer for word in puzzle.words] == ["Bóng", "Chạy", "Nhảy"]
    word_schema = request.await_args.kwargs["json_schema"]["properties"]["words"]["items"]
    assert set(word_schema["properties"]) == {"display_answer", "clue"}
    assert word_schema["required"] == ["display_answer", "clue"]


async def test_word_search_generation_preserves_accented_display_answer(monkeypatch):
    generated_words = [
        {"display_answer": "Chạy bộ", "clue": "Hoạt động nào giúp rèn luyện sức bền bằng cách di chuyển nhanh bằng chân?"},
        {"display_answer": "Bóng đá", "clue": "Môn thể thao đồng đội nào sử dụng chân để đưa bóng vào khung thành?"},
        {"display_answer": "Thể dục", "clue": "Hoạt động vận động nào giúp rèn luyện sức khỏe toàn thân?"},
    ]
    request = AsyncMock(return_value=article_response({"words": generated_words}))
    monkeypatch.setattr(ai_content, "_request_response", request)
    monkeypatch.setattr(ai_content.random, "randint", lambda minimum, maximum: 3)

    puzzle = await ai_content.generate_word_search(
        WordSearchRequest(difficulty="easy", locale="vi")
    )

    assert [word.answer for word in puzzle.words] == ["CHAYBO", "BONGDA", "THEDUC"]
    assert [word.display_answer for word in puzzle.words] == ["Chạy bộ", "Bóng đá", "Thể dục"]
    assert puzzle.size == ai_content._word_search_grid_size([6, 6, 6])
    assert "normal spelling, spaces between words, and diacritics" in request.await_args.args[0]


async def test_word_search_allows_natural_answers_longer_than_ten_letters(monkeypatch):
    generated_words = [
        {"display_answer": "Tiêu dùng xanh", "clue": "Cách mua sắm giảm tác động xấu đến môi trường được gọi là gì?"},
        {"display_answer": "Bóng đá", "clue": "Môn thể thao đồng đội nào sử dụng chân để đưa bóng vào khung thành?"},
        {"display_answer": "Thể dục", "clue": "Hoạt động vận động nào giúp rèn luyện sức khỏe toàn thân?"},
    ]
    request = AsyncMock(return_value=article_response({"words": generated_words}))
    monkeypatch.setattr(ai_content, "_request_response", request)
    monkeypatch.setattr(ai_content.random, "randint", lambda minimum, maximum: 3)

    puzzle = await ai_content.generate_word_search(
        WordSearchRequest(difficulty="hard", locale="vi")
    )

    assert puzzle.words[0].answer == "TIEUDUNGXANH"
    assert puzzle.words[0].display_answer == "Tiêu dùng xanh"
    assert puzzle.size >= len("TIEUDUNGXANH")


async def test_japanese_word_search_uses_ascii_grid_answer_and_japanese_display_answer(monkeypatch):
    generated_words = [
        {"answer": "UNDO", "display_answer": "運動", "clue": "体を動かして健康を保つ活動は何ですか？"},
        {"answer": "KENKO", "display_answer": "健康", "clue": "病気がなく、体の調子がよい状態を何といいますか？"},
        {"answer": "BUNKA", "display_answer": "文化", "clue": "社会に受け継がれる習慣や芸術などを何といいますか？"},
    ]
    request = AsyncMock(return_value=article_response({"words": generated_words}))
    monkeypatch.setattr(ai_content, "_request_response", request)
    monkeypatch.setattr(ai_content.random, "randint", lambda minimum, maximum: 3)

    puzzle = await ai_content.generate_word_search(
        WordSearchRequest(difficulty="medium", locale="ja")
    )

    assert [word.answer for word in puzzle.words] == ["UNDO", "KENKO", "BUNKA"]
    assert [word.display_answer for word in puzzle.words] == ["運動", "健康", "文化"]
    item_schema = request.await_args.kwargs["json_schema"]["properties"]["words"]["items"]
    assert "answer" in item_schema["required"]


async def test_word_search_rejects_display_answer_without_grid_letters(monkeypatch):
    generated_words = [
        {"display_answer": "!!!", "clue": "What does this clue describe?"},
        {"display_answer": "Bóng", "clue": "Vật hình cầu được ném vào rổ trong môn bóng rổ là gì?"},
        {"display_answer": "Chạy", "clue": "Hoạt động di chuyển nhanh bằng chân được gọi là gì?"},
    ]
    request = AsyncMock(return_value=article_response({"words": generated_words}))
    monkeypatch.setattr(ai_content, "_request_response", request)
    monkeypatch.setattr(ai_content.random, "randint", lambda minimum, maximum: 3)

    with pytest.raises(AppError) as error:
        await ai_content.generate_word_search(
            WordSearchRequest(difficulty="easy", locale="vi")
        )
    assert error.value.status_code == 502


def test_word_search_board_scales_with_answer_letters():
    short_answers_board = ai_content._word_search_grid_size([4, 4, 4])
    more_answers_board = ai_content._word_search_grid_size([4, 4, 4, 4, 4])
    longer_answers_board = ai_content._word_search_grid_size([10, 10, 10])
    largest_board = ai_content._word_search_grid_size([10, 10, 10, 10, 10])

    assert short_answers_board < more_answers_board < largest_board
    assert short_answers_board < longer_answers_board < largest_board


def test_word_search_request_rejects_unlisted_difficulty():
    with pytest.raises(ValidationError):
        WordSearchRequest(difficulty="expert", locale="en")


async def test_guest_can_generate_a_word_search_round(client, monkeypatch):
    puzzle = WordSearchPuzzle(
        grid=[["A"] * 12 for _ in range(12)],
        words=[{"answer": "ACTIVE", "displayAnswer": "Active", "clue": "A movement clue"}],
        size=12,
    )
    generate = AsyncMock(return_value=puzzle)
    monkeypatch.setattr(ai_content, "generate_word_search", generate)

    response = await client.post(
        "/api/games/word-search",
        json={"difficulty": "hard", "locale": "en"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["words"][0]["answer"] == "ACTIVE"
    assert response.json()["words"][0]["displayAnswer"] == "Active"
    generate.assert_awaited_once()
    assert generate.await_args.args[0].difficulty == "hard"
    assert generate.await_args.args[0].locale == "en"


async def test_guest_cannot_request_unlisted_word_search_difficulty(client):
    response = await client.post(
        "/api/games/word-search",
        json={"difficulty": "expert", "locale": "vi"},
    )

    assert response.status_code == 400


async def configure_preview(monkeypatch, candidates=None):
    monkeypatch.setattr(
        ai_content,
        "_rss_candidates",
        AsyncMock(return_value=[candidate()] if candidates is None else candidates),
    )
    monkeypatch.setattr(ai_content, "_request_response", AsyncMock(return_value=article_response()))


async def create_ai_post(client, headers, monkeypatch):
    await configure_preview(monkeypatch)
    preview = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4},
        headers=headers,
    )
    assert preview.status_code == 200, preview.text
    data = preview.json()
    posted = await client.post(
        "/api/admin/ai-posts/publish",
        json={
            "topic": data["topic"],
            "hours": data["hours"],
            "sourceUrl": data["sourceUrl"],
            "title": data["title"],
            "content": data["content"],
        },
        headers=headers,
    )
    assert posted.status_code == 201, posted.text
    return posted


async def test_admin_can_preview_edit_and_publish_pending_ai_post(client, monkeypatch):
    admin_csrf = await register(client)
    async with SessionFactory() as db:
        admin = await db.scalar(select(User).where(User.email == "a@bravesoft.com.vn"))
        admin.role = "admin"
        await db.commit()
    await configure_preview(monkeypatch)

    preview = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4},
        headers=admin_csrf,
    )

    assert preview.status_code == 200, preview.text
    data = preview.json()
    assert data["sourceUrl"] == SOURCE_URL
    assert data["sourceTitle"] == "World Health Organization article"
    assert data["hours"] == 4
    assert (await client.get("/api/posts")).json()["posts"] == []

    published = await client.post(
        "/api/admin/ai-posts/publish",
        json={
            "topic": data["topic"],
            "hours": data["hours"],
            "sourceUrl": data["sourceUrl"],
            "title": "Tiêu đề do admin chỉnh sửa",
            "content": "Nội dung đã được quản trị viên biên tập trước khi gửi đi duyệt. " * 3,
        },
        headers=admin_csrf,
    )

    assert published.status_code == 201, published.text
    post = published.json()
    assert post["author"]["displayName"] == "braveActive AI"
    assert post["approved"] is False
    assert post["content"].startswith("Tiêu đề do admin chỉnh sửa\n\n")
    assert post["linkPreview"]["url"] == SOURCE_URL
    assert (await client.get("/api/posts")).json()["posts"] == []


async def test_manual_ai_publish_respects_ai_account_role(client, monkeypatch):
    admin_csrf = await register(client)
    await promote_admin()

    async with SessionFactory() as db:
        ai_user = await ai_content._get_ai_user(db)
        ai_user.role = "admin"
        await db.commit()

    await configure_preview(monkeypatch)
    preview = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4},
        headers=admin_csrf,
    )
    data = preview.json()
    published = await client.post(
        "/api/admin/ai-posts/publish",
        json={
            "topic": data["topic"],
            "hours": data["hours"],
            "sourceUrl": data["sourceUrl"],
            "title": data["title"],
            "content": data["content"],
        },
        headers=admin_csrf,
    )

    assert published.status_code == 201, published.text
    assert published.json()["approved"] is True
    assert (await client.get("/api/posts")).json()["posts"][0]["id"] == published.json()["id"]

    async with SessionFactory() as db:
        ai_user = await ai_content._get_ai_user(db)
        ai_user.role = "user"
        await db.commit()

    second_url = "https://www.who.int/news/item/2026-01-02-health-information"
    await configure_preview(monkeypatch, [candidate(second_url)])
    preview = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4},
        headers=admin_csrf,
    )
    data = preview.json()
    published = await client.post(
        "/api/admin/ai-posts/publish",
        json={
            "topic": data["topic"],
            "hours": data["hours"],
            "sourceUrl": data["sourceUrl"],
            "title": "Bài AI chờ duyệt",
            "content": data["content"],
        },
        headers=admin_csrf,
    )

    assert published.status_code == 201, published.text
    assert published.json()["approved"] is False


async def test_ai_preview_requires_admin_and_openai_key(client, monkeypatch):
    member_csrf = await register(client)
    denied = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4},
        headers=member_csrf,
    )
    assert denied.status_code == 403

    async with SessionFactory() as db:
        member = await db.scalar(select(User).where(User.email == "a@bravesoft.com.vn"))
        member.role = "admin"
        await db.commit()
    monkeypatch.setattr(ai_content, "_rss_candidates", AsyncMock(return_value=[candidate()]))
    settings = get_settings()
    monkeypatch.setattr(ai_content, "get_settings", lambda: settings.model_copy(update={"openai_api_key": ""}))
    response = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4},
        headers=member_csrf,
    )
    assert response.status_code == 503


async def test_preview_rejects_sources_outside_the_selected_feed_domains(client, monkeypatch):
    admin_csrf = await register(client)
    await promote_admin()
    await configure_preview(monkeypatch, [candidate("https://example.invalid/article")])

    response = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4},
        headers=admin_csrf,
    )

    assert response.status_code == 404


async def test_preview_skips_duplicate_urls_with_tracking_parameters(client, monkeypatch):
    admin_csrf = await register(client)
    await promote_admin()
    await configure_preview(monkeypatch)
    await create_ai_post(client, admin_csrf, monkeypatch)
    await configure_preview(monkeypatch, [candidate(f"{SOURCE_URL}?utm_source=newsletter#top")])

    response = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4},
        headers=admin_csrf,
    )

    assert response.status_code == 404


async def test_reload_excludes_sources_already_shown_in_the_dialog(client, monkeypatch):
    admin_csrf = await register(client)
    await promote_admin()
    older = candidate("https://www.who.int/news/older", datetime.now(timezone.utc) - timedelta(minutes=10))
    newest = candidate("https://www.who.int/news/newest", datetime.now(timezone.utc))
    await configure_preview(monkeypatch, [newest, older])

    first = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4},
        headers=admin_csrf,
    )
    second = await client.post(
        "/api/admin/ai-posts/preview",
        json={"topic": "health", "hours": 4, "excludeSourceUrls": [newest.url]},
        headers=admin_csrf,
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["sourceUrl"] == newest.url
    assert second.json()["sourceUrl"] == older.url


async def test_publish_revalidates_source_and_rejects_already_used_url(client, monkeypatch):
    admin_csrf = await register(client)
    await promote_admin()
    await configure_preview(monkeypatch)
    await create_ai_post(client, admin_csrf, monkeypatch)
    await configure_preview(monkeypatch, [candidate(f"{SOURCE_URL}?utm_campaign=duplicate")])

    response = await client.post(
        "/api/admin/ai-posts/publish",
        json={
            "topic": "health",
            "hours": 4,
            "sourceUrl": f"{SOURCE_URL}?utm_source=tracking",
            "title": ARTICLE["title"],
            "content": ARTICLE["content"],
        },
        headers=admin_csrf,
    )

    assert response.status_code == 409


async def test_rss_parser_extracts_article_metadata():
    now = datetime(2026, 11, 18, 12, 0, tzinfo=timezone.utc)
    xml = b"""<?xml version="1.0"?>
    <rss version="2.0"><channel>
      <item>
        <title>New AI update</title>
        <description><![CDATA[<p>A <b>new</b> product update.</p>]]></description>
        <link>https://techcrunch.com/article?utm_source=rss</link>
        <pubDate>Wed, 18 Nov 2026 11:30:00 +0000</pubDate>
      </item>
      <item>
        <title>Old update</title><link>https://techcrunch.com/old</link>
        <description>Older article summary.</description>
        <pubDate>Wed, 18 Nov 2026 07:00:00 +0000</pubDate>
      </item>
      <item>
        <title>Untrusted URL</title><link>https://evil.example/article</link>
        <pubDate>Wed, 18 Nov 2026 11:55:00 +0000</pubDate>
      </item>
    </channel></rss>"""

    items = ai_content._parse_feed(
        xml,
        "technology",
        "https://techcrunch.com/category/artificial-intelligence/feed/",
        now,
    )

    assert len(items) == 2
    assert items[0].title == "New AI update"
    assert items[0].description == "A new product update."
    assert items[0].published_at == datetime(2026, 11, 18, 11, 30, tzinfo=timezone.utc)


async def test_rss_candidate_filter_uses_item_published_time(monkeypatch):
    now = datetime.now(timezone.utc)
    recent = candidate("https://www.who.int/news/recent", now - timedelta(hours=2))
    old = candidate("https://www.who.int/news/old", now - timedelta(hours=6))
    monkeypatch.setattr(
        ai_content,
        "_fetch_feed",
        AsyncMock(return_value=[recent, old]),
    )

    items = await ai_content._rss_candidates("health", 4, now=now)

    assert [item.url for item in items] == [recent.url]


def test_source_url_normalization_only_removes_tracking_and_fragment():
    assert ai_content.normalize_source_url(
        "https://Example.com/article?utm_source=rss&id=5&fbclid=tracking#section"
    ) == "https://example.com/article?id=5"


async def test_openai_request_uses_configured_model_and_schema(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(
        ai_content,
        "get_settings",
        lambda: settings.model_copy(update={"openai_api_key": "test-key"}),
    )
    captured = {}

    class FakeResponse:
        is_error = False

        def json(self):
            return {"output": []}

    class FakeClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, *_):
            return None

        async def post(self, url, **kwargs):
            captured.update(kwargs["json"])
            return FakeResponse()

    monkeypatch.setattr(ai_content.httpx, "AsyncClient", lambda **_: FakeClient())

    await ai_content._request_response(
        "Summarize this RSS article.",
        json_schema={"type": "object", "properties": {"title": {"type": "string"}}},
    )

    assert captured["model"] == settings.openai_model
    assert captured["text"]["format"]["type"] == "json_schema"
    assert "tools" not in captured


async def test_comment_on_approved_ai_post_gets_automatic_ai_reply(client, monkeypatch):
    admin_csrf = await register(client)
    await promote_admin()
    generated = await create_ai_post(client, admin_csrf, monkeypatch)
    post_id = generated.json()["id"]
    approved = await client.post(f"/api/admin/posts/{post_id}/approve", headers=admin_csrf)
    assert approved.status_code == 200

    await client.post("/api/auth/logout", headers=admin_csrf)
    member_csrf = await register(client, "member@bravesoft.com.vn", "Member")
    settings = get_settings()
    monkeypatch.setattr(ai_content, "get_settings", lambda: settings.model_copy(update={"openai_api_key": "test-key"}))
    monkeypatch.setattr(
        ai_content,
        "_request_response",
        AsyncMock(
            return_value={
                "output": [{
                    "type": "message",
                    "content": [{"type": "output_text", "text": "Cảm ơn bạn đã đặt câu hỏi! Đây là thông tin hữu ích."}],
                }]
            }
        ),
    )

    response = await client.post(
        f"/api/posts/{post_id}/comments",
        json={"content": "Bạn có thể chia sẻ thêm thông tin không?"},
        headers=member_csrf,
    )
    assert response.status_code == 201, response.text
    assert response.json()["commentCount"] == 2
    comments = (await client.get(f"/api/posts/{post_id}/comments")).json()
    assert [comment["author"]["displayName"] for comment in comments] == ["Member", "braveActive AI"]


async def test_regular_post_comments_do_not_call_openai(client, monkeypatch):
    member_csrf = await register(client)
    await promote_admin()
    post = await client.post("/api/posts", data={"content": "A member post"}, headers=member_csrf)
    request = AsyncMock()
    monkeypatch.setattr(ai_content, "_request_response", request)

    response = await client.post(
        f"/api/posts/{post.json()['id']}/comments",
        json={"content": "Nice post."},
        headers=member_csrf,
    )

    assert response.status_code == 201
    request.assert_not_awaited()


async def test_comment_on_ai_post_succeeds_when_openai_key_is_missing(client, monkeypatch):
    admin_csrf = await register(client)
    await promote_admin()
    generated = await create_ai_post(client, admin_csrf, monkeypatch)
    post_id = generated.json()["id"]
    await client.post(f"/api/admin/posts/{post_id}/approve", headers=admin_csrf)
    monkeypatch.setattr(
        ai_content,
        "get_settings",
        lambda: get_settings().model_copy(update={"openai_api_key": ""}),
    )

    response = await client.post(
        f"/api/posts/{post_id}/comments",
        json={"content": "Cảm ơn bài viết."},
        headers=admin_csrf,
    )

    assert response.status_code == 201
    comments = (await client.get(f"/api/posts/{post_id}/comments")).json()
    assert len(comments) == 1


async def promote_admin():
    async with SessionFactory() as db:
        user = await db.scalar(select(User).where(User.email == "a@bravesoft.com.vn"))
        user.role = "admin"
        await db.commit()
