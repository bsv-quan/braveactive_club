"""Server-authoritative scoring for community entertainment games."""

import json
import uuid
import asyncio
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models import GameDailyActivity, GameRound, User
from app.services import board_games

STRATEGY_CORRECT_ANSWERS = (0, 1, 0)
DAILY_FREE_HINTS = 2
HINT_COST = 100
WORD_SEARCH_COMPLETION_POINTS = {"easy": 100, "medium": 250, "hard": 500}
BOARD_GAME_WIN_POINTS = {"easy": 100, "medium": 200, "hard": 500}
VIETNAM_TIMEZONE = ZoneInfo("Asia/Ho_Chi_Minh")


def _new_round(user_id: uuid.UUID, game_type: str, state: dict) -> GameRound:
    return GameRound(user_id=user_id, game_type=game_type, state=json.dumps(state))


async def start_word_search_round(
    db: AsyncSession,
    user: User,
    grid: list[list[str]],
    answers: list[str],
    difficulty: str,
) -> GameRound:
    game_round = _new_round(
        user.id,
        "word_search",
        {
            "grid": grid,
            "answers": answers,
            "found": [],
            "hinted": [],
            "difficulty": difficulty,
        },
    )
    db.add(game_round)
    await db.commit()
    await db.refresh(game_round)
    return game_round


async def start_strategy_round(db: AsyncSession, user: User) -> GameRound:
    game_round = _new_round(
        user.id,
        "strategy",
        {"next_question": 0},
    )
    db.add(game_round)
    await db.commit()
    await db.refresh(game_round)
    return game_round


async def start_board_game(
    db: AsyncSession,
    user: User | None,
    game_type: str,
    difficulty: str,
) -> dict:
    if user is not None:
        game_round = await _active_board_round(db, user, game_type)
        if game_round is None:
            state = board_games.create_game(game_type)
            state["difficulty"] = difficulty
            game_round = _new_round(user.id, game_type, state)
            db.add(game_round)
            await db.commit()
            await db.refresh(game_round)
        return _board_game_response(game_round)

    state = board_games.create_game(game_type)
    state["difficulty"] = difficulty
    return {
        "round_id": None,
        "state": state,
        "score": 0,
        "score_awarded": 0,
    }


async def get_active_board_game(db: AsyncSession, user: User, game_type: str) -> dict | None:
    game_round = await _active_board_round(db, user, game_type)
    return _board_game_response(game_round) if game_round is not None else None


async def abandon_active_board_game(db: AsyncSession, user: User, game_type: str) -> None:
    game_round = await _active_board_round(db, user, game_type)
    if game_round is None:
        return
    game_round.completed_at = datetime.now(timezone.utc)
    await db.commit()


async def forfeit_board_game(
    db: AsyncSession,
    user: User | None,
    game_type: str,
    round_id: uuid.UUID | None,
    guest_state: dict | None,
) -> dict:
    if round_id is not None:
        if user is None:
            raise AppError("Vui lòng đăng nhập lại để bỏ cuộc.", 401)
        game_round = await _get_open_round(db, user, round_id, game_type)
        state = json.loads(game_round.state)
        next_state = board_games.forfeit_game(game_type, state)
        game_round.state = json.dumps(next_state)
        await _complete_board_round(db, user, game_round, next_state, state.get("difficulty", "easy"))
        await db.commit()
        return {
            "round_id": game_round.id,
            "state": next_state,
            "score": game_round.score,
            "score_awarded": 0,
        }

    if guest_state is None:
        raise AppError("Không tìm thấy trạng thái lượt chơi.", 400)
    next_state = board_games.forfeit_game(game_type, guest_state)
    return {"round_id": None, "state": next_state, "score": 0, "score_awarded": 0}


async def _active_board_round(db: AsyncSession, user: User, game_type: str) -> GameRound | None:
    return await db.scalar(
        select(GameRound)
        .where(
            GameRound.user_id == user.id,
            GameRound.game_type == game_type,
            GameRound.completed_at.is_(None),
        )
        .order_by(GameRound.created_at.desc(), GameRound.id.desc())
        .limit(1)
    )


def _board_game_response(game_round: GameRound) -> dict:
    state = json.loads(game_round.state)
    if not state.get("terminal"):
        state["check"] = board_games.is_current_player_in_check(game_round.game_type, state)
    return {
        "round_id": game_round.id,
        "state": state,
        "score": game_round.score,
        "score_awarded": 0,
    }


async def submit_board_game_move(
    db: AsyncSession,
    user: User | None,
    game_type: str,
    difficulty: str,
    move: dict,
    round_id: uuid.UUID | None,
    guest_state: dict | None,
) -> dict:
    game_round = None
    if round_id is not None:
        if user is None:
            raise AppError("Vui lòng đăng nhập lại để tiếp tục lượt chơi đã lưu.", 401)
        game_round = await _get_open_round(db, user, round_id, game_type)
        state = json.loads(game_round.state)
        difficulty = state.get("difficulty", difficulty)
    else:
        if guest_state is None:
            raise AppError("Không tìm thấy trạng thái lượt chơi.", 400)
        state = guest_state

    try:
        next_state = board_games.apply_player_move(game_type, state, move)
    except ValueError as exc:
        raise AppError("Nước đi không hợp lệ.", 400) from exc

    if game_round is not None:
        if user is None:
            raise AppError("Vui lòng đăng nhập lại để tiếp tục lượt chơi đã lưu.", 401)
        game_round.state = json.dumps(next_state)
        score_awarded = await _complete_board_round(db, user, game_round, next_state, difficulty)
        await db.commit()
        score = game_round.score
    else:
        score_awarded = _board_win_score(next_state, difficulty)
        score = score_awarded

    return {
        "round_id": game_round.id if game_round else None,
        "state": next_state,
        "score": score,
        "score_awarded": score_awarded,
    }


async def submit_board_game_bot_turn(
    db: AsyncSession,
    user: User | None,
    game_type: str,
    difficulty: str,
    round_id: uuid.UUID | None,
    guest_state: dict | None,
) -> dict:
    game_round = None
    if round_id is not None:
        if user is None:
            raise AppError("Vui lòng đăng nhập lại để tiếp tục lượt chơi đã lưu.", 401)
        game_round = await db.scalar(
            select(GameRound)
            .where(
                GameRound.id == round_id,
                GameRound.user_id == user.id,
                GameRound.game_type == game_type,
            )
            .with_for_update()
        )
        if game_round is None:
            raise AppError("Không tìm thấy lượt chơi.", 404)
        state = json.loads(game_round.state)
        difficulty = state.get("difficulty", difficulty)
        if game_round.completed_at is not None or state.get("terminal"):
            return _board_game_response(game_round)
    else:
        if guest_state is None:
            raise AppError("Không tìm thấy trạng thái lượt chơi.", 400)
        state = guest_state
        if state.get("terminal"):
            return {
                "round_id": None,
                "state": state,
                "score": _board_win_score(state, difficulty),
                "score_awarded": 0,
            }

    if state.get("turn") != state.get("ai"):
        if game_round is not None:
            return _board_game_response(game_round)
        return {
            "round_id": None,
            "state": state,
            "score": 0,
            "score_awarded": 0,
        }

    try:
        next_state = await asyncio.to_thread(board_games.apply_ai_move, game_type, state, difficulty)
    except ValueError as exc:
        raise AppError("Máy không thể thực hiện nước đi.", 500) from exc

    if game_round is not None:
        if user is None:
            raise AppError("Vui lòng đăng nhập lại để tiếp tục lượt chơi đã lưu.", 401)
        game_round.state = json.dumps(next_state)
        score_awarded = await _complete_board_round(db, user, game_round, next_state, difficulty)
        await db.commit()
        score = game_round.score
    else:
        score_awarded = _board_win_score(next_state, difficulty)
        score = score_awarded

    return {
        "round_id": game_round.id if game_round else None,
        "state": next_state,
        "score": score,
        "score_awarded": score_awarded,
    }


def _board_win_score(state: dict, difficulty: str) -> int:
    if state.get("terminal") and state.get("winner") == state.get("human"):
        return BOARD_GAME_WIN_POINTS[difficulty]
    return 0


async def _complete_board_round(
    db: AsyncSession,
    user: User,
    game_round: GameRound,
    state: dict,
    difficulty: str,
) -> int:
    if not state["terminal"] or game_round.completed_at is not None:
        return 0
    game_round.completed_at = datetime.now(timezone.utc)
    score_awarded = _board_win_score(state, difficulty)
    game_round.score += score_awarded
    await _record_attendance(db, user.id)
    return score_awarded


async def _get_open_round(
    db: AsyncSession,
    user: User,
    round_id: uuid.UUID,
    game_type: str,
) -> GameRound:
    game_round = await db.scalar(
        select(GameRound)
        .where(
            GameRound.id == round_id,
            GameRound.user_id == user.id,
            GameRound.game_type == game_type,
        )
        .with_for_update()
    )
    if game_round is None:
        raise AppError("Không tìm thấy lượt chơi.", 404)
    if game_round.completed_at is not None:
        raise AppError("Lượt chơi này đã kết thúc.", 409)
    return game_round


def _is_straight_path(cells: list[int], size: int) -> bool:
    if len(cells) < 2 or len(set(cells)) != len(cells) or any(
        cell < 0 or cell >= size * size for cell in cells
    ):
        return False
    rows = [cell // size for cell in cells]
    columns = [cell % size for cell in cells]
    row_step = rows[1] - rows[0]
    column_step = columns[1] - columns[0]
    if not (
        row_step == 0
        or column_step == 0
        or abs(row_step) == abs(column_step)
    ):
        return False
    row_step = (row_step > 0) - (row_step < 0)
    column_step = (column_step > 0) - (column_step < 0)
    return all(
        rows[index] == rows[0] + index * row_step
        and columns[index] == columns[0] + index * column_step
        for index in range(len(cells))
    )


def _vietnam_today() -> date:
    return datetime.now(VIETNAM_TIMEZONE).date()


async def _lock_user(db: AsyncSession, user_id: uuid.UUID) -> None:
    await db.scalar(select(User.id).where(User.id == user_id).with_for_update())


async def _daily_activity(
    db: AsyncSession,
    user_id: uuid.UUID,
    activity_date: date,
) -> GameDailyActivity | None:
    return await db.scalar(
        select(GameDailyActivity).where(
            GameDailyActivity.user_id == user_id,
            GameDailyActivity.activity_date == activity_date,
        )
    )


async def _get_or_create_daily_activity(
    db: AsyncSession,
    user_id: uuid.UUID,
    activity_date: date,
) -> GameDailyActivity:
    activity = await _daily_activity(db, user_id, activity_date)
    if activity is None:
        activity = GameDailyActivity(user_id=user_id, activity_date=activity_date)
        db.add(activity)
        await db.flush()
    return activity


async def _record_attendance(db: AsyncSession, user_id: uuid.UUID) -> None:
    await _lock_user(db, user_id)
    activity = await _get_or_create_daily_activity(db, user_id, _vietnam_today())
    activity.attended = True


async def submit_word_search_guess(
    db: AsyncSession,
    user: User,
    round_id: uuid.UUID,
    cells: list[int],
) -> dict:
    game_round = await _get_open_round(db, user, round_id, "word_search")
    state = json.loads(game_round.state)
    grid: list[list[str]] = state["grid"]
    answers: list[str] = state["answers"]
    found: list[int] = state["found"]
    size = len(grid)
    selected = "".join(grid[cell // size][cell % size] for cell in cells) if all(
        0 <= cell < size * size for cell in cells
    ) else ""
    match = next(
        (
            index
            for index, answer in enumerate(answers)
            if index not in found
            and len(cells) == len(answer)
            and selected == answer
            and _is_straight_path(cells, size)
        ),
        None,
    )
    if match is None:
        score_awarded = 0
        correct = False
    else:
        found.append(match)
        score_awarded = 0
        correct = True
    complete = len(found) == len(answers)
    if complete:
        completion_points = WORD_SEARCH_COMPLETION_POINTS[state["difficulty"]]
        game_round.score += completion_points
        score_awarded += completion_points
        game_round.completed_at = datetime.now(timezone.utc)
        await _record_attendance(db, user.id)
    state["found"] = found
    game_round.state = json.dumps(state)
    await db.commit()
    return {
        "correct": correct,
        "found_words": found,
        "score_awarded": score_awarded,
        "score": game_round.score,
        "complete": complete,
    }


def _find_word_cell(grid: list[list[str]], answer: str) -> int | None:
    size = len(grid)
    for row in range(size):
        for column in range(size):
            for row_step, column_step in ((0, 1), (1, 0), (1, 1), (1, -1)):
                end_row = row + (len(answer) - 1) * row_step
                end_column = column + (len(answer) - 1) * column_step
                if not (0 <= end_row < size and 0 <= end_column < size):
                    continue
                letters = "".join(
                    grid[row + index * row_step][column + index * column_step]
                    for index in range(len(answer))
                )
                if letters == answer:
                    return row * size + column
    return None


async def use_word_search_hint(
    db: AsyncSession,
    user: User,
    round_id: uuid.UUID,
) -> dict:
    game_round = await _get_open_round(db, user, round_id, "word_search")
    state = json.loads(game_round.state)
    found: list[int] = state["found"]
    hinted: list[int] = state["hinted"]
    answer_index = next(
        (
            index
            for index in range(len(state["answers"]))
            if index not in found and index not in hinted
        ),
        None,
    )
    if answer_index is None:
        return {
            "cell": None,
            "score_awarded": 0,
            "score": game_round.score,
            "free_hints_remaining": await _free_hints_remaining(db, user.id),
            "word_search_points": await _word_search_points(db, user.id),
        }

    await _lock_user(db, user.id)
    today = _vietnam_today()
    activity = await _get_or_create_daily_activity(db, user.id, today)
    score_awarded = 0
    if activity.free_hints_used < DAILY_FREE_HINTS:
        activity.free_hints_used += 1
    else:
        points = await _word_search_points(db, user.id)
        if points < HINT_COST:
            raise AppError("Bạn chưa đủ 100 điểm Ô chữ để dùng gợi ý.", 409)
        game_round.score -= HINT_COST
        score_awarded = -HINT_COST
    hinted.append(answer_index)
    cell = _find_word_cell(state["grid"], state["answers"][answer_index])
    state["hinted"] = hinted
    game_round.state = json.dumps(state)
    await db.commit()
    return {
        "cell": cell,
        "score_awarded": score_awarded,
        "score": game_round.score,
        "free_hints_remaining": DAILY_FREE_HINTS - activity.free_hints_used,
        "word_search_points": await _word_search_points(db, user.id),
    }


async def _free_hints_remaining(db: AsyncSession, user_id: uuid.UUID) -> int:
    activity = await _daily_activity(db, user_id, _vietnam_today())
    return DAILY_FREE_HINTS - activity.free_hints_used if activity else DAILY_FREE_HINTS


async def _word_search_points(db: AsyncSession, user_id: uuid.UUID) -> int:
    points = await db.scalar(
        select(func.coalesce(func.sum(GameRound.score), 0)).where(
            GameRound.user_id == user_id,
            GameRound.game_type == "word_search",
        )
    )
    return int(points or 0)


def _current_streak(activity_dates: list[date], today: date) -> int:
    if not activity_dates:
        return 0
    latest = activity_dates[0]
    if latest < today - timedelta(days=1):
        return 0
    streak = 0
    expected = latest
    for activity_date in activity_dates:
        if activity_date != expected:
            break
        streak += 1
        expected -= timedelta(days=1)
    return streak


async def get_game_status(db: AsyncSession, user: User) -> dict:
    today = _vietnam_today()
    activity_dates = list(
        await db.scalars(
            select(GameDailyActivity.activity_date)
            .where(
                GameDailyActivity.user_id == user.id,
                GameDailyActivity.attended.is_(True),
            )
            .order_by(GameDailyActivity.activity_date.desc())
        )
    )
    activity = await _daily_activity(db, user.id, today)
    return {
        "streak_days": _current_streak(activity_dates, today),
        "played_today": today in activity_dates,
        "free_hints_remaining": DAILY_FREE_HINTS - activity.free_hints_used
        if activity
        else DAILY_FREE_HINTS,
        "word_search_points": await _word_search_points(db, user.id),
    }


async def submit_strategy_answer(
    db: AsyncSession,
    user: User,
    round_id: uuid.UUID,
    question_index: int,
    answer_index: int,
) -> dict:
    game_round = await _get_open_round(db, user, round_id, "strategy")
    state = json.loads(game_round.state)
    if question_index != state["next_question"]:
        raise AppError("Câu hỏi này đã được trả lời hoặc chưa đến lượt.", 409)
    correct = answer_index == STRATEGY_CORRECT_ANSWERS[question_index]
    state["next_question"] += 1
    complete = state["next_question"] == len(STRATEGY_CORRECT_ANSWERS)
    if complete:
        game_round.completed_at = datetime.now(timezone.utc)
        await _record_attendance(db, user.id)
    game_round.state = json.dumps(state)
    await db.commit()
    return {
        "correct": correct,
        "score_awarded": 0,
        "score": game_round.score,
        "complete": complete,
    }


async def get_leaderboard(
    db: AsyncSession,
    period: str,
    game_type: str,
) -> dict:
    now = datetime.now(timezone.utc)
    if game_type == "strategy":
        return {
            "period": period,
            "game_type": game_type,
            "entries": [],
            "updated_at": now,
        }
    local_now = now.astimezone(VIETNAM_TIMEZONE)
    if period == "week":
        local_start = (local_now - timedelta(days=local_now.weekday())).replace(
            hour=0, minute=0, second=0, microsecond=0,
        )
    else:
        local_start = local_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    start = local_start.astimezone(timezone.utc)
    rows = await db.execute(
        select(
            User.id,
            User.display_name,
            func.sum(GameRound.score).label("score"),
        )
        .join(GameRound, GameRound.user_id == User.id)
        .where(GameRound.game_type == game_type, GameRound.completed_at >= start)
        .group_by(User.id, User.display_name)
        .order_by(func.sum(GameRound.score).desc(), User.display_name.asc())
        .limit(10)
    )
    entries = [
        {
            "rank": rank,
            "user_id": row.id,
            "display_name": row.display_name,
            "score": row.score,
        }
        for rank, row in enumerate(rows, start=1)
    ]
    return {
        "period": period,
        "game_type": game_type,
        "entries": entries,
        "updated_at": now,
    }
