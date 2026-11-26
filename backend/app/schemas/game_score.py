"""Entertainment-game scoring and leaderboard schemas."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import Field, model_validator

from app.schemas.base import CamelModel

LeaderboardPeriod = Literal["week", "month"]
BoardGameType = Literal["chess", "xiangqi", "go"]
GameType = Literal["word_search", "strategy", "chess", "xiangqi", "go"]


class BoardGameStartRequest(CamelModel):
    difficulty: Literal["easy", "medium", "hard"]


class BoardGameMove(CamelModel):
    from_position: tuple[Annotated[int, Field(ge=0, le=9)], Annotated[int, Field(ge=0, le=9)]] | None = Field(
        default=None,
        alias="from",
    )
    to: tuple[Annotated[int, Field(ge=0, le=9)], Annotated[int, Field(ge=0, le=9)]] | None = None
    at: tuple[Annotated[int, Field(ge=0, le=9)], Annotated[int, Field(ge=0, le=9)]] | None = None
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


class GameStatus(CamelModel):
    streak_days: int
    played_today: bool
    free_hints_remaining: int
    word_search_points: int


class StrategyAnswerRequest(CamelModel):
    question_index: int = Field(ge=0, le=2)
    answer_index: int = Field(ge=0, le=2)


class StrategyAnswerResult(CamelModel):
    correct: bool
    score_awarded: int
    score: int
    complete: bool


class LeaderboardEntry(CamelModel):
    rank: int
    user_id: UUID
    display_name: str
    score: int


class LeaderboardOut(CamelModel):
    period: LeaderboardPeriod
    game_type: GameType
    entries: list[LeaderboardEntry]
    updated_at: datetime
