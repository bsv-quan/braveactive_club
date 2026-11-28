"""Server-authoritative scoring for community entertainment games."""

import json
import uuid
import asyncio
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import AppError
from app.models import GameDailyActivity, GameRound, User
from app.services import board_games, sudoku

STRATEGY_CORRECT_ANSWERS = (0, 1, 0)
DAILY_FREE_HINTS = 2
HINT_COST = 100
WORD_SEARCH_COMPLETION_POINTS = {"easy": 100, "medium": 250, "hard": 500}
SUDOKU_COMPLETION_POINTS = {"easy": 100, "medium": 250, "hard": 500}
BOARD_GAME_WIN_POINTS = {"easy": 100, "medium": 200, "hard": 500}
DEV_VS_AI_STAGE_POINTS = {1: 150, 2: 250, 3: 350}
DEV_VS_AI_BOSS_POINTS = 500
DEV_VS_AI_ENDLESS_WAVE_POINTS = 50
DEV_VS_AI_ENDLESS_MAX_POINTS = 500
SCORED_GAME_TYPES = ("dev_vs_ai", "word_search", "chess", "xiangqi", "go", "caro", "sudoku")
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
        shared_points = await _total_points(db, user.id)
        return {
            "cell": None,
            "score_awarded": 0,
            "score": game_round.score,
            "free_hints_remaining": await _free_hints_remaining(db, user.id),
            "word_search_points": shared_points,
            "total_points": shared_points,
        }

    await _lock_user(db, user.id)
    today = _vietnam_today()
    activity = await _get_or_create_daily_activity(db, user.id, today)
    score_awarded = 0
    if activity.free_hints_used < DAILY_FREE_HINTS:
        activity.free_hints_used += 1
    else:
        points = await _total_points(db, user.id)
        if points < HINT_COST:
            raise AppError("Bạn chưa đủ 100 điểm giải trí để dùng gợi ý.", 409)
        game_round.score -= HINT_COST
        score_awarded = -HINT_COST
    hinted.append(answer_index)
    cell = _find_word_cell(state["grid"], state["answers"][answer_index])
    state["hinted"] = hinted
    game_round.state = json.dumps(state)
    await db.commit()
    shared_points = await _total_points(db, user.id)
    return {
        "cell": cell,
        "score_awarded": score_awarded,
        "score": game_round.score,
        "free_hints_remaining": DAILY_FREE_HINTS - activity.free_hints_used,
        "word_search_points": shared_points,
        "total_points": shared_points,
    }


async def start_dev_vs_ai_round(
    db: AsyncSession,
    user: User,
    stage_id: str,
) -> GameRound:
    cleaned_stage = stage_id.strip()
    if not cleaned_stage or len(cleaned_stage) > 32:
        raise AppError("Màn chơi không hợp lệ.", 400)
    game_round = _new_round(
        user.id,
        "dev_vs_ai",
        {"stage_id": cleaned_stage},
    )
    db.add(game_round)
    await db.commit()
    await db.refresh(game_round)
    return game_round


async def complete_dev_vs_ai_round(
    db: AsyncSession,
    user: User,
    round_id: uuid.UUID,
    status: str,
    stars_earned: int,
    endless_wave: int,
) -> dict:
    game_round = await _get_open_round(db, user, round_id, "dev_vs_ai")
    state = json.loads(game_round.state)
    stage_id = str(state.get("stage_id", "1-1"))

    if status == "victory":
        if stage_id == "3-4":
            score_awarded = DEV_VS_AI_BOSS_POINTS
        else:
            clamped_stars = max(1, min(3, int(stars_earned or 1)))
            score_awarded = DEV_VS_AI_STAGE_POINTS[clamped_stars]
    elif stage_id == "on-call" and endless_wave > 0:
        score_awarded = min(
            DEV_VS_AI_ENDLESS_MAX_POINTS,
            max(0, int(endless_wave)) * DEV_VS_AI_ENDLESS_WAVE_POINTS,
        )
    else:
        score_awarded = 0

    state["status"] = status
    state["stars_earned"] = int(stars_earned)
    state["endless_wave"] = int(endless_wave)
    game_round.state = json.dumps(state)
    game_round.score += score_awarded
    game_round.completed_at = datetime.now(timezone.utc)
    await _record_attendance(db, user.id)
    await db.commit()

    today = _vietnam_today()
    activity_dates = await _user_activity_dates(db, user.id)
    return {
        "score_awarded": score_awarded,
        "score": game_round.score,
        "total_points": await _total_points(db, user.id),
        "streak_days": _current_streak(activity_dates, today),
        "played_today": today in activity_dates,
    }


async def _free_hints_remaining(db: AsyncSession, user_id: uuid.UUID) -> int:
    activity = await _daily_activity(db, user_id, _vietnam_today())
    return DAILY_FREE_HINTS - activity.free_hints_used if activity else DAILY_FREE_HINTS


async def _total_points(db: AsyncSession, user_id: uuid.UUID) -> int:
    points = await db.scalar(
        select(func.coalesce(func.sum(GameRound.score), 0)).where(
            GameRound.user_id == user_id,
            GameRound.game_type.in_(SCORED_GAME_TYPES),
        )
    )
    return int(points or 0)


async def _word_search_points(db: AsyncSession, user_id: uuid.UUID) -> int:
    return await _total_points(db, user_id)


async def _user_activity_dates(db: AsyncSession, user_id: uuid.UUID) -> list[date]:
    return list(
        await db.scalars(
            select(GameDailyActivity.activity_date)
            .where(
                GameDailyActivity.user_id == user_id,
                GameDailyActivity.attended.is_(True),
            )
            .order_by(GameDailyActivity.activity_date.desc())
        )
    )


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


def _longest_streak(activity_dates: list[date]) -> int:
    if not activity_dates:
        return 0
    longest = 1
    current = 1
    for index in range(1, len(activity_dates)):
        if activity_dates[index - 1] - activity_dates[index] == timedelta(days=1):
            current += 1
            if current > longest:
                longest = current
        else:
            current = 1
    return longest


def _rank_tier(total_points: int) -> tuple[str, int | None]:
    if total_points < 300:
        return "rookie", 300
    if total_points < 1000:
        return "challenger", 1000
    if total_points < 2500:
        return "master", 2500
    if total_points < 5000:
        return "grandmaster", 5000
    return "legend", None


async def get_game_status(db: AsyncSession, user: User) -> dict:
    today = _vietnam_today()
    activity_dates = await _user_activity_dates(db, user.id)
    activity = await _daily_activity(db, user.id, today)
    shared_points = await _total_points(db, user.id)
    completed_rounds = await db.scalar(
        select(func.count(GameRound.id)).where(
            GameRound.user_id == user.id,
            GameRound.game_type.in_(SCORED_GAME_TYPES),
            GameRound.completed_at.is_not(None),
        )
    )
    return {
        "streak_days": _current_streak(activity_dates, today),
        "longest_streak_days": _longest_streak(activity_dates),
        "played_today": today in activity_dates,
        "free_hints_remaining": DAILY_FREE_HINTS - activity.free_hints_used
        if activity
        else DAILY_FREE_HINTS,
        "word_search_points": shared_points,
        "total_points": shared_points,
        "total_rounds": int(completed_rounds or 0),
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


def _sudoku_response(
    game_round: GameRound | None,
    state: dict,
    *,
    score_awarded: int = 0,
    include_solution: bool = False,
) -> dict:
    return {
        "round_id": game_round.id if game_round is not None else None,
        "difficulty": state["difficulty"],
        "puzzle": state["puzzle"],
        "board": state["board"],
        "hinted_cells": state.get("hinted_cells", []),
        "solution": state["solution"] if include_solution else None,
        "completed": bool(state.get("completed", False)),
        "score": game_round.score if game_round is not None else 0,
        "score_awarded": score_awarded,
    }


async def start_sudoku_game(
    db: AsyncSession,
    user: User | None,
    difficulty: str,
) -> dict:
    if user is not None:
        game_round = await _active_board_round(db, user, "sudoku")
        if game_round is not None:
            return _sudoku_response(game_round, json.loads(game_round.state))
        puzzle, solution = await asyncio.to_thread(sudoku.generate_sudoku, difficulty)
        state = {
            "difficulty": difficulty,
            "puzzle": puzzle,
            "board": [row[:] for row in puzzle],
            "solution": solution,
            "hinted_cells": [],
            "completed": False,
        }
        game_round = _new_round(user.id, "sudoku", state)
        db.add(game_round)
        await db.commit()
        await db.refresh(game_round)
        return _sudoku_response(game_round, state)

    puzzle, solution = await asyncio.to_thread(sudoku.generate_sudoku, difficulty)
    state = {
        "difficulty": difficulty,
        "puzzle": puzzle,
        "board": [row[:] for row in puzzle],
        "solution": solution,
        "hinted_cells": [],
        "completed": False,
    }
    return _sudoku_response(None, state, include_solution=True)


async def get_active_sudoku_game(db: AsyncSession, user: User) -> dict | None:
    game_round = await _active_board_round(db, user, "sudoku")
    if game_round is None:
        return None
    return _sudoku_response(game_round, json.loads(game_round.state))


async def abandon_active_sudoku_game(db: AsyncSession, user: User) -> None:
    await abandon_active_board_game(db, user, "sudoku")


async def sync_sudoku_board(
    db: AsyncSession,
    user: User,
    round_id: uuid.UUID,
    board: list[list[int]],
) -> dict:
    game_round = await _get_open_round(db, user, round_id, "sudoku")
    state = json.loads(game_round.state)
    puzzle: list[list[int]] = state["puzzle"]
    solution: list[list[int]] = state["solution"]

    if not sudoku.validate_board_shape(board) or not sudoku.respects_givens(board, puzzle):
        raise AppError("Bảng Sudoku không hợp lệ.", 400)

    state["board"] = [row[:] for row in board]
    score_awarded = 0
    if board == solution or sudoku.is_solved_sudoku(board):
        state["completed"] = True
        game_round.completed_at = datetime.now(timezone.utc)
        score_awarded = SUDOKU_COMPLETION_POINTS.get(state.get("difficulty", "medium"), 250)
        game_round.score += score_awarded
        await _record_attendance(db, user.id)

    game_round.state = json.dumps(state)
    await db.commit()
    return _sudoku_response(game_round, state, score_awarded=score_awarded)


async def use_sudoku_hint(
    db: AsyncSession,
    user: User,
    round_id: uuid.UUID,
    row: int | None = None,
    col: int | None = None,
    client_board: list[list[int]] | None = None,
) -> dict:
    game_round = await _get_open_round(db, user, round_id, "sudoku")
    state = json.loads(game_round.state)
    puzzle: list[list[int]] = state["puzzle"]
    board: list[list[int]] = state["board"]
    if client_board is not None and sudoku.validate_board_shape(client_board) and sudoku.respects_givens(client_board, puzzle):
        board = [r[:] for r in client_board]
    solution: list[list[int]] = state["solution"]
    hinted_cells: list[list[int]] = state.get("hinted_cells", [])

    target: tuple[int, int] | None = None
    if (
        row is not None
        and col is not None
        and puzzle[row][col] == 0
        and board[row][col] != solution[row][col]
    ):
        target = (row, col)
    else:
        for r in range(9):
            for c in range(9):
                if puzzle[r][c] == 0 and board[r][c] != solution[r][c]:
                    target = (r, c)
                    break
            if target is not None:
                break

    if target is None:
        shared_points = await _total_points(db, user.id)
        return {
            "row": None,
            "col": None,
            "value": None,
            "board": board,
            "hinted_cells": hinted_cells,
            "completed": bool(state.get("completed", False)),
            "score": game_round.score,
            "score_awarded": 0,
            "free_hints_remaining": await _free_hints_remaining(db, user.id),
            "total_points": shared_points,
        }

    await _lock_user(db, user.id)
    today = _vietnam_today()
    activity = await _get_or_create_daily_activity(db, user.id, today)
    score_awarded = 0
    if activity.free_hints_used < DAILY_FREE_HINTS:
        activity.free_hints_used += 1
    else:
        points = await _total_points(db, user.id)
        if points < HINT_COST:
            raise AppError("Bạn chưa đủ 100 điểm giải trí để dùng gợi ý.", 409)
        game_round.score -= HINT_COST
        score_awarded = -HINT_COST

    tr, tc = target
    revealed = solution[tr][tc]
    board[tr][tc] = revealed
    if [tr, tc] not in hinted_cells:
        hinted_cells.append([tr, tc])
    state["board"] = board
    state["hinted_cells"] = hinted_cells

    if board == solution or sudoku.is_solved_sudoku(board):
        state["completed"] = True
        game_round.completed_at = datetime.now(timezone.utc)
        completion_bonus = SUDOKU_COMPLETION_POINTS.get(state.get("difficulty", "medium"), 250)
        game_round.score += completion_bonus
        score_awarded += completion_bonus
        await _record_attendance(db, user.id)

    game_round.state = json.dumps(state)
    await db.commit()
    shared_points = await _total_points(db, user.id)
    return {
        "row": tr,
        "col": tc,
        "value": revealed,
        "board": board,
        "hinted_cells": hinted_cells,
        "completed": bool(state.get("completed", False)),
        "score": game_round.score,
        "score_awarded": score_awarded,
        "free_hints_remaining": DAILY_FREE_HINTS - activity.free_hints_used,
        "total_points": shared_points,
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
    conditions = [GameRound.completed_at.is_not(None)]
    if game_type == "all":
        conditions.append(GameRound.game_type.in_(SCORED_GAME_TYPES))
    else:
        conditions.append(GameRound.game_type == game_type)

    if period != "all":
        local_now = now.astimezone(VIETNAM_TIMEZONE)
        if period == "week":
            local_start = (local_now - timedelta(days=local_now.weekday())).replace(
                hour=0, minute=0, second=0, microsecond=0,
            )
        else:
            local_start = local_now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        conditions.append(GameRound.completed_at >= local_start.astimezone(timezone.utc))

    rows = await db.execute(
        select(
            User.id,
            User.display_name,
            User.avatar_name,
            func.coalesce(func.sum(GameRound.score), 0).label("score"),
            func.count(GameRound.id).label("rounds_played"),
        )
        .join(GameRound, GameRound.user_id == User.id)
        .where(*conditions)
        .group_by(User.id, User.display_name, User.avatar_name)
        .order_by(func.coalesce(func.sum(GameRound.score), 0).desc(), User.display_name.asc())
        .limit(25)
    )
    entries = [
        {
            "rank": rank,
            "user_id": row.id,
            "display_name": row.display_name,
            "avatar_url": f"/media/{row.avatar_name}" if row.avatar_name else None,
            "score": int(row.score or 0),
            "rounds_played": int(row.rounds_played or 0),
        }
        for rank, row in enumerate(rows, start=1)
    ]
    return {
        "period": period,
        "game_type": game_type,
        "entries": entries,
        "updated_at": now,
    }


async def get_game_achievements(
    db: AsyncSession,
    user: User | None,
) -> dict:
    now = datetime.now(timezone.utc)
    club_row = (
        await db.execute(
            select(
                func.count(func.distinct(GameRound.user_id)).label("total_players"),
                func.count(GameRound.id).label("total_rounds"),
                func.coalesce(func.sum(case((GameRound.score > 0, GameRound.score), else_=0)), 0).label("total_points"),
            ).where(
                GameRound.game_type.in_(SCORED_GAME_TYPES),
                GameRound.completed_at.is_not(None),
            )
        )
    ).one()

    club = {
        "total_players": int(club_row.total_players or 0),
        "total_rounds": int(club_row.total_rounds or 0),
        "total_points": int(club_row.total_points or 0),
    }

    if user is None:
        return {
            "me": None,
            "club": club,
            "updated_at": now,
        }

    today = _vietnam_today()
    activity_dates = await _user_activity_dates(db, user.id)
    streak_days = _current_streak(activity_dates, today)
    longest_streak = _longest_streak(activity_dates)
    active_days = len(activity_dates)
    played_today = today in activity_dates

    per_game_rows = await db.execute(
        select(
            GameRound.game_type,
            func.count(GameRound.id).label("rounds_played"),
            func.coalesce(func.sum(case((GameRound.score > 0, 1), else_=0)), 0).label("wins"),
            func.coalesce(func.sum(GameRound.score), 0).label("total_score"),
            func.coalesce(func.max(GameRound.score), 0).label("best_score"),
        )
        .where(
            GameRound.user_id == user.id,
            GameRound.game_type.in_(SCORED_GAME_TYPES),
            GameRound.completed_at.is_not(None),
        )
        .group_by(GameRound.game_type)
    )
    by_type = {
        row.game_type: {
            "game_type": row.game_type,
            "rounds_played": int(row.rounds_played or 0),
            "wins": int(row.wins or 0),
            "total_score": max(0, int(row.total_score or 0)),
            "best_score": max(0, int(row.best_score or 0)),
        }
        for row in per_game_rows
    }

    per_game = [
        by_type.get(
            gtype,
            {
                "game_type": gtype,
                "rounds_played": 0,
                "wins": 0,
                "total_score": 0,
                "best_score": 0,
            },
        )
        for gtype in SCORED_GAME_TYPES
    ]

    total_points = await _total_points(db, user.id)
    total_rounds = sum(item["rounds_played"] for item in per_game)
    total_wins = sum(item["wins"] for item in per_game)
    games_explored = sum(1 for item in per_game if item["rounds_played"] > 0)
    tier, next_tier_points = _rank_tier(max(0, total_points))

    user_rank: int | None = None
    if total_rounds > 0:
        all_ranks = await db.execute(
            select(
                User.id,
                func.coalesce(func.sum(GameRound.score), 0).label("score"),
            )
            .join(GameRound, GameRound.user_id == User.id)
            .where(
                GameRound.game_type.in_(SCORED_GAME_TYPES),
                GameRound.completed_at.is_not(None),
            )
            .group_by(User.id, User.display_name)
            .order_by(func.coalesce(func.sum(GameRound.score), 0).desc(), User.display_name.asc())
        )
        for idx, row in enumerate(all_ranks, start=1):
            if row.id == user.id:
                user_rank = idx
                break

    badges = [
        {
            "id": "first_round",
            "unlocked": total_rounds >= 1,
            "progress": min(total_rounds, 1),
            "target": 1,
        },
        {
            "id": "streak_3",
            "unlocked": longest_streak >= 3,
            "progress": min(longest_streak, 3),
            "target": 3,
        },
        {
            "id": "streak_7",
            "unlocked": longest_streak >= 7,
            "progress": min(longest_streak, 7),
            "target": 7,
        },
        {
            "id": "explorer",
            "unlocked": games_explored >= 3,
            "progress": min(games_explored, 3),
            "target": 3,
        },
        {
            "id": "tactician",
            "unlocked": total_wins >= 5,
            "progress": min(total_wins, 5),
            "target": 5,
        },
        {
            "id": "points_1000",
            "unlocked": total_points >= 1000,
            "progress": min(max(0, total_points), 1000),
            "target": 1000,
        },
    ]

    return {
        "me": {
            "user_id": user.id,
            "display_name": user.display_name,
            "avatar_url": user.avatar_url,
            "rank": user_rank,
            "tier": tier,
            "next_tier_points": next_tier_points,
            "total_points": total_points,
            "total_rounds": total_rounds,
            "total_wins": total_wins,
            "streak_days": streak_days,
            "longest_streak_days": longest_streak,
            "active_days": active_days,
            "played_today": played_today,
            "games_explored": games_explored,
            "per_game": per_game,
            "badges": badges,
        },
        "club": club,
        "updated_at": now,
    }
