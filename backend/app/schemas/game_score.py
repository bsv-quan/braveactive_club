"""Entertainment-game scoring and leaderboard schemas."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.schemas.base import CamelModel

LeaderboardPeriod = Literal["week", "month", "all"]
BoardGameType = Literal["chess", "xiangqi", "go", "caro"]
GameType = Literal["all", "word_search", "strategy", "chess", "xiangqi", "go", "caro", "sudoku", "dev_vs_ai"]
ArcadeRankTier = Literal["rookie", "challenger", "master", "grandmaster", "legend"]


class BoardGameStartRequest(CamelModel):
    difficulty: Literal["easy", "medium", "hard"]


class BoardGameMove(CamelModel):
    from_position: tuple[Annotated[int, Field(ge=0, le=14)], Annotated[int, Field(ge=0, le=14)]] | None = Field(
        default=None,
        alias="from",
    )
    to: tuple[Annotated[int, Field(ge=0, le=14)], Annotated[int, Field(ge=0, le=14)]] | None = None
    at: tuple[Annotated[int, Field(ge=0, le=14)], Annotated[int, Field(ge=0, le=14)]] | None = None
    pass_turn: bool = Field(default=False, alias="pass")
    promotion: Literal["q", "r", "b", "n"] | None = None

    @model_validator(mode="after")
    def validate_move_shape(self):
        has_from = self.from_position is not None
        has_to = self.to is not None
        if has_from != has_to or sum((has_from, self.at is not None, self.pass_turn)) != 1:
            raise ValueError("Provide either from/to, at, or pass.")
        return self

    def as_engine_move(self) -> dict:
        if self.pass_turn:
            return {"pass": True}
        if self.at is not None:
            return {"at": list(self.at)}
        if self.from_position is None or self.to is None:
            raise ValueError("Provide both a source and destination.")
        move = {"from": list(self.from_position), "to": list(self.to)}
        if self.promotion is not None:
            move["promotion"] = self.promotion
        return move


class BoardGameMoveRequest(CamelModel):
    difficulty: Literal["easy", "medium", "hard"]
    move: BoardGameMove
    round_id: UUID | None = None
    state: dict | None = None


class BoardGameBotTurnRequest(CamelModel):
    difficulty: Literal["easy", "medium", "hard"]
    round_id: UUID | None = None
    state: dict | None = None


class BoardGameForfeitRequest(CamelModel):
    round_id: UUID | None = None
    state: dict | None = None


class BoardGameResponse(CamelModel):
    round_id: UUID | None
    state: dict
    score: int
    score_awarded: int


class WordSearchGuessRequest(CamelModel):
    cells: list[int] = Field(min_length=2, max_length=16)


class GameRoundStarted(CamelModel):
    round_id: UUID


class WordSearchGuessResult(CamelModel):
    correct: bool
    found_words: list[int]
    score_awarded: int
    score: int
    complete: bool


class WordSearchHintResult(CamelModel):
    cell: int | None
    score_awarded: int
    score: int
    free_hints_remaining: int
    word_search_points: int
    total_points: int = 0


class GameStatus(CamelModel):
    streak_days: int
    longest_streak_days: int = 0
    played_today: bool
    free_hints_remaining: int
    word_search_points: int
    total_points: int = 0
    total_rounds: int = 0


class DevVsAiStartRequest(CamelModel):
    stage_id: str = Field(min_length=1, max_length=32)


class DevVsAiCompleteRequest(CamelModel):
    status: Literal["victory", "defeat"]
    stars_earned: Annotated[int, Field(ge=0, le=3)] = 0
    endless_wave: Annotated[int, Field(ge=0, le=999)] = 0


class DevVsAiCompleteResult(CamelModel):
    score_awarded: int
    score: int
    total_points: int
    streak_days: int
    played_today: bool


class StrategyAnswerRequest(CamelModel):
    question_index: int = Field(ge=0, le=2)
    answer_index: int = Field(ge=0, le=2)


class StrategyAnswerResult(CamelModel):
    correct: bool
    score_awarded: int
    score: int
    complete: bool


class SudokuStartRequest(CamelModel):
    difficulty: Literal["easy", "medium", "hard"]


class SudokuSyncRequest(CamelModel):
    board: list[list[Annotated[int, Field(ge=0, le=9)]]] = Field(min_length=9, max_length=9)

    @model_validator(mode="after")
    def validate_square_grid(self):
        if any(len(row) != 9 for row in self.board):
            raise ValueError("Sudoku board must be a 9x9 grid.")
        return self


class SudokuHintRequest(CamelModel):
    row: Annotated[int, Field(ge=0, le=8)] | None = None
    col: Annotated[int, Field(ge=0, le=8)] | None = None
    board: list[list[Annotated[int, Field(ge=0, le=9)]]] | None = Field(default=None, min_length=9, max_length=9)

    @model_validator(mode="after")
    def validate_optional_board(self):
        if self.board is not None and any(len(r) != 9 for r in self.board):
            raise ValueError("Sudoku board must be a 9x9 grid.")
        return self


class SudokuStateResponse(CamelModel):
    round_id: UUID | None
    difficulty: Literal["easy", "medium", "hard"]
    puzzle: list[list[int]]
    board: list[list[int]]
    hinted_cells: list[list[int]] = Field(default_factory=list)
    solution: list[list[int]] | None = None
    completed: bool
    score: int
    score_awarded: int


class SudokuHintResponse(CamelModel):
    row: int | None
    col: int | None
    value: int | None
    board: list[list[int]]
    hinted_cells: list[list[int]] = Field(default_factory=list)
    completed: bool
    score: int
    score_awarded: int
    free_hints_remaining: int
    total_points: int = 0


class LeaderboardEntry(CamelModel):
    rank: int
    user_id: UUID
    display_name: str
    avatar_url: str | None = None
    score: int
    rounds_played: int = 0


class LeaderboardOut(CamelModel):
    period: LeaderboardPeriod
    game_type: GameType
    entries: list[LeaderboardEntry]
    updated_at: datetime


class MiniGameStatOut(CamelModel):
    game_type: str
    rounds_played: int
    wins: int
    total_score: int
    best_score: int


class AchievementBadgeOut(CamelModel):
    id: str
    unlocked: bool
    progress: int
    target: int


class PersonalAchievementsOut(CamelModel):
    user_id: UUID
    display_name: str
    avatar_url: str | None = None
    rank: int | None = None
    tier: ArcadeRankTier
    next_tier_points: int | None = None
    total_points: int
    total_rounds: int
    total_wins: int
    streak_days: int
    longest_streak_days: int
    active_days: int
    played_today: bool
    games_explored: int
    per_game: list[MiniGameStatOut]
    badges: list[AchievementBadgeOut]


class ClubArcadeOverviewOut(CamelModel):
    total_players: int
    total_rounds: int
    total_points: int


class GameAchievementsOut(CamelModel):
    me: PersonalAchievementsOut | None = None
    club: ClubArcadeOverviewOut
    updated_at: datetime
