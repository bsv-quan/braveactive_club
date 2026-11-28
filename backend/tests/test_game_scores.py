import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.db.session import SessionFactory
from app.models import GameDailyActivity, GameRound, User
from app.schemas.ai_content import WordSearchPuzzle
from app.services import ai_content, game_scores
from tests.conftest import register


async def test_word_search_score_is_calculated_and_saved_on_server(client, monkeypatch):
    csrf = await register(client)
    puzzle = WordSearchPuzzle(
        grid=[
            ["C", "A", "T", "S"],
            ["D", "O", "G", "S"],
            ["B", "I", "K", "E"],
            ["R", "A", "T", "S"],
        ],
        words=[
            {"answer": "CATS", "displayAnswer": "Cats", "clue": "A clue about cats?"},
            {"answer": "DOGS", "displayAnswer": "Dogs", "clue": "A clue about dogs?"},
            {"answer": "BIKE", "displayAnswer": "Bike", "clue": "A clue about bikes?"},
        ],
        size=4,
    )
    monkeypatch.setattr(ai_content, "generate_word_search", lambda _: _async_value(puzzle))

    generated = await client.post(
        "/api/games/word-search",
        headers=csrf,
        json={"difficulty": "easy", "locale": "en"},
    )

    assert generated.status_code == 200
    round_id = generated.json()["roundId"]
    hint = await client.post(
        f"/api/games/word-search/{round_id}/hint",
        headers=csrf,
    )
    assert hint.status_code == 200
    assert hint.json()["cell"] == 0
    assert hint.json()["score"] == 0
    assert hint.json()["scoreAwarded"] == 0
    assert hint.json()["freeHintsRemaining"] == 1

    second_hint = await client.post(
        f"/api/games/word-search/{round_id}/hint",
        headers=csrf,
    )
    assert second_hint.status_code == 200
    assert second_hint.json()["freeHintsRemaining"] == 0

    paid_hint_without_points = await client.post(
        f"/api/games/word-search/{round_id}/hint",
        headers=csrf,
    )
    assert paid_hint_without_points.status_code == 409
    before_completion = await client.get("/api/games/status", headers=csrf)
    assert before_completion.status_code == 200
    assert before_completion.json()["playedToday"] is False
    assert before_completion.json()["streakDays"] == 0

    wrong = await client.post(
        f"/api/games/word-search/{round_id}/guess",
        headers=csrf,
        json={"cells": [12, 13, 14, 15]},
    )
    assert wrong.status_code == 200
    assert wrong.json()["score"] == 0
    assert wrong.json()["scoreAwarded"] == 0

    correct = await client.post(
        f"/api/games/word-search/{round_id}/guess",
        headers=csrf,
        json={"cells": [0, 1, 2, 3]},
    )
    assert correct.status_code == 200
    assert correct.json()["correct"] is True
    assert correct.json()["complete"] is False
    assert correct.json()["score"] == 0
    assert correct.json()["scoreAwarded"] == 0

    second_answer = await client.post(
        f"/api/games/word-search/{round_id}/guess",
        headers=csrf,
        json={"cells": [4, 5, 6, 7]},
    )
    assert second_answer.status_code == 200
    assert second_answer.json()["complete"] is False

    final_answer = await client.post(
        f"/api/games/word-search/{round_id}/guess",
        headers=csrf,
        json={"cells": [8, 9, 10, 11]},
    )
    assert final_answer.status_code == 200
    assert final_answer.json()["complete"] is True
    assert final_answer.json()["score"] == 100
    assert final_answer.json()["scoreAwarded"] == 100

    status = await client.get("/api/games/status", headers=csrf)
    assert status.status_code == 200
    assert status.json()["playedToday"] is True
    assert status.json()["streakDays"] == 1
    assert status.json()["freeHintsRemaining"] == 0
    assert status.json()["wordSearchPoints"] == 100

    next_round = await client.post(
        "/api/games/word-search",
        headers=csrf,
        json={"difficulty": "easy", "locale": "en"},
    )
    assert next_round.status_code == 200
    paid_hint = await client.post(
        f"/api/games/word-search/{next_round.json()['roundId']}/hint",
        headers=csrf,
    )
    assert paid_hint.status_code == 200
    assert paid_hint.json()["scoreAwarded"] == -100
    assert paid_hint.json()["wordSearchPoints"] == 0

    repeated = await client.post(
        f"/api/games/word-search/{round_id}/guess",
        headers=csrf,
        json={"cells": [0, 1, 2, 3]},
    )
    assert repeated.status_code == 409


@pytest.mark.parametrize(
    ("difficulty", "expected_points"),
    [("easy", 100), ("medium", 250), ("hard", 500)],
)
async def test_word_search_completion_points_depend_on_difficulty(
    client,
    monkeypatch,
    difficulty,
    expected_points,
):
    csrf = await register(client)
    puzzle = WordSearchPuzzle(
        grid=[["C", "A", "T", "S"]] * 4,
        words=[{"answer": "CATS", "displayAnswer": "Cats", "clue": "A clue about cats?"}],
        size=4,
    )
    monkeypatch.setattr(ai_content, "generate_word_search", lambda _: _async_value(puzzle))

    generated = await client.post(
        "/api/games/word-search",
        headers=csrf,
        json={"difficulty": difficulty, "locale": "en"},
    )
    completed = await client.post(
        f"/api/games/word-search/{generated.json()['roundId']}/guess",
        headers=csrf,
        json={"cells": [0, 1, 2, 3]},
    )

    assert completed.status_code == 200
    assert completed.json()["score"] == expected_points
    assert completed.json()["scoreAwarded"] == expected_points


async def test_guests_can_play_but_cannot_submit_ranked_scores(client, monkeypatch):
    puzzle = WordSearchPuzzle(
        grid=[["C", "A", "T", "S"]] * 4,
        words=[{"answer": "CATS", "displayAnswer": "Cats", "clue": "A clue about cats?"}],
        size=4,
    )
    monkeypatch.setattr(ai_content, "generate_word_search", lambda _: _async_value(puzzle))

    generated = await client.post(
        "/api/games/word-search",
        json={"difficulty": "easy", "locale": "en"},
    )

    assert generated.status_code == 200
    assert generated.json()["roundId"] is None
    score_attempt = await client.post(
        f"/api/games/word-search/{uuid.uuid4()}/guess",
        json={"cells": [0, 1, 2, 3]},
    )
    assert score_attempt.status_code == 401


async def test_strategy_round_rejects_replayed_answers_and_scores_completion(client):
    csrf = await register(client)
    started = await client.post("/api/games/strategy/start", headers=csrf)
    assert started.status_code == 200
    round_id = started.json()["roundId"]

    first = await client.post(
        f"/api/games/strategy/{round_id}/answer",
        headers=csrf,
        json={"questionIndex": 0, "answerIndex": 0},
    )
    assert first.status_code == 200
    assert first.json()["correct"] is True
    assert first.json()["score"] == 0

    replay = await client.post(
        f"/api/games/strategy/{round_id}/answer",
        headers=csrf,
        json={"questionIndex": 0, "answerIndex": 0},
    )
    assert replay.status_code == 409

    for question_index, answer_index in ((1, 1), (2, 0)):
        result = await client.post(
            f"/api/games/strategy/{round_id}/answer",
            headers=csrf,
            json={"questionIndex": question_index, "answerIndex": answer_index},
        )
        assert result.status_code == 200
    assert result.json()["complete"] is True
    assert result.json()["score"] == 0


async def test_strategy_wrong_answer_does_not_reduce_score(client):
    csrf = await register(client)
    started = await client.post("/api/games/strategy/start", headers=csrf)
    assert started.status_code == 200
    round_id = started.json()["roundId"]

    wrong = await client.post(
        f"/api/games/strategy/{round_id}/answer",
        headers=csrf,
        json={"questionIndex": 0, "answerIndex": 1},
    )
    assert wrong.status_code == 200
    assert wrong.json()["correct"] is False
    assert wrong.json()["score"] == 0
    assert wrong.json()["scoreAwarded"] == 0


async def test_leaderboard_sums_all_member_rounds_for_selected_period(client):
    await register(client, email="leader@bravesoft.com.vn", name="Leader")
    async with SessionFactory() as db:
        user = await db.scalar(
            select(User).where(User.email == "leader@bravesoft.com.vn")
        )
        assert user is not None
        db.add_all([
            GameRound(
                user_id=user.id,
                game_type="strategy",
                state='{"next_question":3}',
                score=0,
                completed_at=datetime.now(timezone.utc),
            ),
            GameRound(
                user_id=user.id,
                game_type="word_search",
                state='{}',
                score=140,
                completed_at=datetime.now(timezone.utc),
            ),
        ])
        await db.commit()

    response = await client.get(
        "/api/games/leaderboard?period=week&gameType=word_search"
    )

    assert response.status_code == 200
    assert response.json()["gameType"] == "word_search"
    assert response.json()["entries"][0]["displayName"] == "Leader"
    assert response.json()["entries"][0]["score"] == 140

    strategy_response = await client.get(
        "/api/games/leaderboard?period=week&gameType=strategy"
    )
    assert strategy_response.status_code == 200
    assert strategy_response.json()["entries"] == []


async def test_daily_free_hint_quota_resets_on_vietnam_day(client):
    csrf = await register(client)
    async with SessionFactory() as db:
        user = await db.scalar(select(User).where(User.email == "a@bravesoft.com.vn"))
        assert user is not None
        db.add(
            GameDailyActivity(
                user_id=user.id,
                activity_date=game_scores._vietnam_today() - timedelta(days=1),
                free_hints_used=2,
            )
        )
        await db.commit()

    status = await client.get("/api/games/status", headers=csrf)

    assert status.status_code == 200
    assert status.json()["playedToday"] is False
    assert status.json()["freeHintsRemaining"] == 2
    assert status.json()["streakDays"] == 0


async def test_active_board_game_can_be_restored_and_start_reuses_it(client, monkeypatch):
    csrf = await register(client)
    empty = await client.get("/api/games/board/chess/active", headers=csrf)
    assert empty.status_code == 200
    assert empty.json() is None

    started = await client.post(
        "/api/games/board/chess/start",
        headers=csrf,
        json={"difficulty": "hard"},
    )
    assert started.status_code == 200
    round_id = started.json()["roundId"]

    restored = await client.get("/api/games/board/chess/active", headers=csrf)
    assert restored.status_code == 200
    assert restored.json()["roundId"] == round_id
    assert restored.json()["state"] == started.json()["state"]
    assert restored.json()["state"]["difficulty"] == "hard"

    started_again = await client.post(
        "/api/games/board/chess/start",
        headers=csrf,
        json={"difficulty": "easy"},
    )
    assert started_again.json()["roundId"] == round_id
    assert started_again.json()["state"] == started.json()["state"]

    monkeypatch.setattr(
        game_scores.board_games,
        "apply_player_move",
        lambda _game_type, state, move: {**state, "last_move": move},
    )
    monkeypatch.setattr(
        game_scores.board_games,
        "apply_ai_move",
        lambda _game_type, state, _difficulty: state,
    )
    moved = await client.post(
        "/api/games/board/chess/move",
        headers=csrf,
        json={
            "difficulty": "hard",
            "move": {"from": [6, 4], "to": [4, 4]},
            "roundId": round_id,
        },
    )
    assert moved.status_code == 200

    restored_after_move = await client.get("/api/games/board/chess/active", headers=csrf)
    assert restored_after_move.json()["roundId"] == round_id
    assert restored_after_move.json()["state"]["last_move"] == {"from": [6, 4], "to": [4, 4]}

    abandoned = await client.delete("/api/games/board/chess/active", headers=csrf)
    assert abandoned.status_code == 200
    assert abandoned.json() == {"ok": True}
    no_active_round = await client.get("/api/games/board/chess/active", headers=csrf)
    assert no_active_round.status_code == 200
    assert no_active_round.json() is None

    restarted = await client.post(
        "/api/games/board/chess/start",
        headers=csrf,
        json={"difficulty": "medium"},
    )
    assert restarted.status_code == 200
    assert restarted.json()["roundId"] != round_id
    assert restarted.json()["state"]["difficulty"] == "medium"
    restored_after_restart = await client.get("/api/games/board/chess/active", headers=csrf)
    assert restored_after_restart.json()["roundId"] == restarted.json()["roundId"]

    async with SessionFactory() as db:
        abandoned_round = await db.get(GameRound, uuid.UUID(round_id))
        assert abandoned_round is not None
        assert abandoned_round.completed_at is not None
        assert abandoned_round.score == 0


@pytest.mark.parametrize(
    ("game_type", "expected_result", "expected_winner"),
    [("chess", "black_win", "black"), ("xiangqi", "black_win", "black"), ("go", "white_win", "white")],
)
async def test_board_forfeit_records_loss_zero_points_and_attendance(client, game_type, expected_result, expected_winner):
    csrf = await register(client)
    started = await client.post(
        f"/api/games/board/{game_type}/start",
        headers=csrf,
        json={"difficulty": "hard"},
    )
    round_id = started.json()["roundId"]

    forfeited = await client.post(
        f"/api/games/board/{game_type}/forfeit",
        headers=csrf,
        json={"roundId": round_id},
    )

    assert forfeited.status_code == 200
    assert forfeited.json()["score"] == 0
    assert forfeited.json()["scoreAwarded"] == 0
    assert forfeited.json()["state"]["terminal"] is True
    assert forfeited.json()["state"]["result"] == expected_result
    assert forfeited.json()["state"]["winner"] == expected_winner

    status = await client.get("/api/games/status", headers=csrf)
    assert status.json()["playedToday"] is True
    assert status.json()["streakDays"] == 1

    repeated = await client.post(
        f"/api/games/board/{game_type}/forfeit",
        headers=csrf,
        json={"roundId": round_id},
    )
    assert repeated.status_code == 409


@pytest.mark.parametrize("game_type", ["chess", "xiangqi", "go"])
async def test_guest_board_forfeit_returns_terminal_loss(client, game_type):
    started = await client.post(
        f"/api/games/board/{game_type}/start",
        json={"difficulty": "easy"},
    )
    forfeited = await client.post(
        f"/api/games/board/{game_type}/forfeit",
        json={"state": started.json()["state"]},
    )

    assert forfeited.status_code == 200
    assert forfeited.json()["roundId"] is None
    assert forfeited.json()["score"] == 0
    assert forfeited.json()["state"]["terminal"] is True


async def test_active_board_game_requires_authentication(client):
    response = await client.get("/api/games/board/chess/active")

    assert response.status_code == 401


@pytest.mark.parametrize(
    ("game_type", "expected_result"),
    [("chess", "white_win"), ("xiangqi", "red_win"), ("go", "black_win")],
)
@pytest.mark.parametrize(
    ("difficulty", "expected_points"),
    [("easy", 100), ("medium", 200), ("hard", 500)],
)
async def test_board_game_wins_award_difficulty_points_and_use_server_state(
    client,
    monkeypatch,
    game_type,
    expected_result,
    difficulty,
    expected_points,
):
    csrf = await register(client)
    started = await client.post(
        f"/api/games/board/{game_type}/start",
        headers=csrf,
        json={"difficulty": difficulty},
    )
    assert started.status_code == 200
    round_id = started.json()["roundId"]
    initial_board = started.json()["state"]["board"]

    def apply_player_move(_game_type, state, move):
        assert state["board"] == initial_board
        assert move == {"from": [6, 4], "to": [4, 4]}
        return {**state, "turn": state["ai"], "last_move": move}

    def apply_ai_move(_game_type, state, _difficulty):
        return {
            **state,
            "turn": state["human"],
            "result": expected_result,
            "winner": state["human"],
            "terminal": True,
        }

    monkeypatch.setattr(game_scores.board_games, "apply_player_move", apply_player_move)
    monkeypatch.setattr(game_scores.board_games, "apply_ai_move", apply_ai_move)
    player_move = await client.post(
        f"/api/games/board/{game_type}/move",
        headers=csrf,
        json={
            "difficulty": difficulty,
            "move": {"from": [6, 4], "to": [4, 4]},
            "roundId": round_id,
            "state": {"game_type": game_type, "human": "cheat"},
        },
    )

    assert player_move.status_code == 200
    assert player_move.json()["state"]["turn"] == player_move.json()["state"]["ai"]
    assert player_move.json()["score"] == 0
    async with SessionFactory() as db:
        saved_round = await db.get(GameRound, uuid.UUID(round_id))
        assert saved_round is not None
        assert json.loads(saved_round.state)["turn"] == json.loads(saved_round.state)["ai"]
    restored_before_bot = await client.get(
        f"/api/games/board/{game_type}/active",
        headers=csrf,
    )
    assert restored_before_bot.status_code == 200
    assert restored_before_bot.json()["roundId"] == round_id
    assert restored_before_bot.json()["state"]["turn"] == restored_before_bot.json()["state"]["ai"]

    completed = await client.post(
        f"/api/games/board/{game_type}/bot-turn",
        headers=csrf,
        json={"difficulty": difficulty, "roundId": round_id},
    )
    assert completed.status_code == 200
    assert completed.json()["state"]["result"] == expected_result
    assert completed.json()["score"] == expected_points
    assert completed.json()["scoreAwarded"] == expected_points
    duplicate_bot_turn = await client.post(
        f"/api/games/board/{game_type}/bot-turn",
        headers=csrf,
        json={"difficulty": difficulty, "roundId": round_id},
    )
    assert duplicate_bot_turn.status_code == 200
    assert duplicate_bot_turn.json()["score"] == expected_points
    assert duplicate_bot_turn.json()["scoreAwarded"] == 0
    replayed = await client.post(
        f"/api/games/board/{game_type}/start",
        headers=csrf,
        json={"difficulty": difficulty},
    )
    assert replayed.status_code == 200
    assert replayed.json()["roundId"] != round_id
    assert replayed.json()["state"]["result"] == "ongoing"
    async with SessionFactory() as db:
        game_round = await db.get(GameRound, uuid.UUID(round_id))
        assert game_round is not None
        assert game_round.game_type == game_type
        assert game_round.score == expected_points
        assert game_round.completed_at is not None
    status = await client.get("/api/games/status", headers=csrf)
    assert status.json()["playedToday"] is True
    leaderboard = await client.get(
        f"/api/games/leaderboard?period=week&gameType={game_type}"
    )
    assert leaderboard.status_code == 200
    assert leaderboard.json()["gameType"] == game_type
    assert leaderboard.json()["entries"][0]["score"] == expected_points


@pytest.mark.parametrize(("result", "winner"), [("draw", "draw"), ("black_win", "black")])
async def test_board_draw_or_loss_awards_no_points(client, monkeypatch, result, winner):
    csrf = await register(client)
    started = await client.post(
        "/api/games/board/chess/start",
        headers=csrf,
        json={"difficulty": "hard"},
    )
    round_id = started.json()["roundId"]

    monkeypatch.setattr(
        game_scores.board_games,
        "apply_player_move",
        lambda _game_type, state, _move: {**state, "turn": state["ai"]},
    )
    monkeypatch.setattr(
        game_scores.board_games,
        "apply_ai_move",
        lambda _game_type, state, _difficulty: {
            **state,
            "result": result,
            "winner": winner,
            "terminal": True,
        },
    )
    player_move = await client.post(
        "/api/games/board/chess/move",
        headers=csrf,
        json={
            "difficulty": "hard",
            "move": {"from": [6, 4], "to": [4, 4]},
            "roundId": round_id,
        },
    )

    assert player_move.status_code == 200
    response = await client.post(
        "/api/games/board/chess/bot-turn",
        headers=csrf,
        json={"difficulty": "hard", "roundId": round_id},
    )
    assert response.status_code == 200
    assert response.json()["score"] == 0
    assert response.json()["scoreAwarded"] == 0


async def test_guest_board_game_is_unranked(client, monkeypatch):
    started = await client.post(
        "/api/games/board/go/start",
        json={"difficulty": "easy"},
    )
    assert started.status_code == 200
    assert started.json()["roundId"] is None

    monkeypatch.setattr(
        game_scores.board_games,
        "apply_player_move",
        lambda _game_type, state, _move: {
            **state,
            "result": "black_win",
            "winner": "black",
            "terminal": True,
        },
    )
    response = await client.post(
        "/api/games/board/go/move",
        json={
            "difficulty": "easy",
            "move": {"at": [0, 0]},
            "state": started.json()["state"],
        },
    )

    assert response.status_code == 200
    assert response.json()["roundId"] is None
    assert response.json()["score"] == 100
    assert response.json()["scoreAwarded"] == 100


async def test_guest_move_is_returned_before_bot_turn(client, monkeypatch):
    started = await client.post(
        "/api/games/board/chess/start",
        json={"difficulty": "easy"},
    )
    state_after_player = {
        **started.json()["state"],
        "turn": "black",
        "last_move": {"from": [6, 4], "to": [4, 4]},
    }
    monkeypatch.setattr(
        game_scores.board_games,
        "apply_player_move",
        lambda _game_type, _state, _move: state_after_player,
    )
    monkeypatch.setattr(
        game_scores.board_games,
        "apply_ai_move",
        lambda _game_type, state, _difficulty: {**state, "turn": "white"},
    )

    player_move = await client.post(
        "/api/games/board/chess/move",
        json={
            "difficulty": "easy",
            "move": {"from": [6, 4], "to": [4, 4]},
            "state": started.json()["state"],
        },
    )
    assert player_move.status_code == 200
    assert player_move.json()["state"]["turn"] == "black"
    assert player_move.json()["state"]["last_move"] == {"from": [6, 4], "to": [4, 4]}

    bot_move = await client.post(
        "/api/games/board/chess/bot-turn",
        json={"difficulty": "easy", "state": player_move.json()["state"]},
    )
    assert bot_move.status_code == 200
    assert bot_move.json()["state"]["turn"] == "white"


async def test_invalid_board_move_does_not_complete_round(client, monkeypatch):
    csrf = await register(client)
    started = await client.post(
        "/api/games/board/chess/start",
        headers=csrf,
        json={"difficulty": "easy"},
    )
    round_id = started.json()["roundId"]

    def reject_move(_game_type, _state, _move):
        raise ValueError("illegal chess move")

    monkeypatch.setattr(game_scores.board_games, "apply_player_move", reject_move)
    response = await client.post(
        "/api/games/board/chess/move",
        headers=csrf,
        json={
            "difficulty": "easy",
            "move": {"from": [7, 0], "to": [5, 0]},
            "roundId": round_id,
        },
    )

    assert response.status_code == 400
    async with SessionFactory() as db:
        game_round = await db.get(GameRound, uuid.UUID(round_id))
        assert game_round is not None
        assert game_round.completed_at is None
        assert game_round.score == 0


def test_streak_counts_consecutive_vietnam_calendar_days():
    today = game_scores._vietnam_today()

    assert game_scores._current_streak(
        [today, today - timedelta(days=1), today - timedelta(days=2)],
        today,
    ) == 3
    assert game_scores._current_streak([today - timedelta(days=1)], today) == 1
    assert game_scores._current_streak([today - timedelta(days=2)], today) == 0
    assert game_scores._longest_streak(
        [
            today,
            today - timedelta(days=3),
            today - timedelta(days=4),
            today - timedelta(days=5),
            today - timedelta(days=6),
        ]
    ) == 4


async def test_shared_points_streak_and_achievements_across_all_games(client, monkeypatch):
    csrf = await register(client, email="arcade@bravesoft.com.vn", name="Arcade Hero")

    # 1. Complete a Dev vs AI 3-star stage (+350 pts) and verify streak + shared points
    started_dev = await client.post(
        "/api/games/dev-vs-ai/start",
        headers=csrf,
        json={"stageId": "1-1"},
    )
    assert started_dev.status_code == 200
    dev_round_id = started_dev.json()["roundId"]

    completed_dev = await client.post(
        f"/api/games/dev-vs-ai/{dev_round_id}/complete",
        headers=csrf,
        json={"status": "victory", "starsEarned": 3, "endlessWave": 0},
    )
    assert completed_dev.status_code == 200
    assert completed_dev.json()["scoreAwarded"] == 350
    assert completed_dev.json()["totalPoints"] == 350
    assert completed_dev.json()["playedToday"] is True
    assert completed_dev.json()["streakDays"] == 1

    # Replaying the same completed Dev vs AI round is rejected
    replayed_dev = await client.post(
        f"/api/games/dev-vs-ai/{dev_round_id}/complete",
        headers=csrf,
        json={"status": "victory", "starsEarned": 3, "endlessWave": 0},
    )
    assert replayed_dev.status_code == 409

    # 2. Spend shared points earned in Dev vs AI on a paid Word Search hint
    puzzle = WordSearchPuzzle(
        grid=[
            ["C", "A", "T", "S"],
            ["D", "O", "G", "S"],
            ["B", "I", "K", "E"],
            ["R", "A", "T", "S"],
        ],
        words=[
            {"answer": "CATS", "displayAnswer": "Cats", "clue": "Clue 1"},
            {"answer": "DOGS", "displayAnswer": "Dogs", "clue": "Clue 2"},
            {"answer": "BIKE", "displayAnswer": "Bike", "clue": "Clue 3"},
        ],
        size=4,
    )
    monkeypatch.setattr(ai_content, "generate_word_search", lambda _: _async_value(puzzle))
    ws_round = await client.post(
        "/api/games/word-search",
        headers=csrf,
        json={"difficulty": "easy", "locale": "en"},
    )
    ws_id = ws_round.json()["roundId"]
    # Exhaust 2 free hints, then spend 100 shared points from Dev vs AI
    await client.post(f"/api/games/word-search/{ws_id}/hint", headers=csrf)
    await client.post(f"/api/games/word-search/{ws_id}/hint", headers=csrf)
    paid_hint = await client.post(f"/api/games/word-search/{ws_id}/hint", headers=csrf)
    assert paid_hint.status_code == 200
    assert paid_hint.json()["scoreAwarded"] == -100
    assert paid_hint.json()["totalPoints"] == 250

    # 3. Verify unified leaderboard (gameType=all, period=all) and personal/club achievements
    all_leaderboard = await client.get("/api/games/leaderboard?period=all&gameType=all")
    assert all_leaderboard.status_code == 200
    assert all_leaderboard.json()["gameType"] == "all"
    assert all_leaderboard.json()["entries"][0]["displayName"] == "Arcade Hero"
    assert all_leaderboard.json()["entries"][0]["score"] == 350  # completed rounds sum

    achievements = await client.get("/api/games/achievements", headers=csrf)
    assert achievements.status_code == 200
    payload = achievements.json()
    assert payload["me"] is not None
    assert payload["me"]["totalPoints"] == 250
    assert payload["me"]["streakDays"] == 1
    assert payload["me"]["rank"] == 1
    assert payload["me"]["tier"] == "rookie"
    assert payload["club"]["totalPlayers"] >= 1
    assert any(b["id"] == "first_round" and b["unlocked"] is True for b in payload["me"]["badges"])

    # Guest achievements endpoint returns club overview with me=None
    client.cookies.clear()
    guest_achievements = await client.get("/api/games/achievements")
    assert guest_achievements.status_code == 200
    assert guest_achievements.json()["me"] is None
    assert guest_achievements.json()["club"]["totalPlayers"] >= 1


async def _async_value(value):
    return value
