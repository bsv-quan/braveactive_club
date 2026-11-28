"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { Lottie } from "lottie-react";
import { ArrowLeft, CircleAlert, Flag, Gamepad2, LoaderCircle, RotateCcw, X } from "lucide-react";
import gameOverAnimation from "@/components/games/animations/game-over.json";
import trophyAnimation from "@/components/games/animations/trophy.json";
import { GameZoneIllustration } from "@/components/games/illustrations/game-zone-illustration";
import { useDialog } from "@/components/ui/confirm-dialog";
import { useI18n } from "@/i18n/i18n-provider";
import { ApiError, errorMessage } from "@/lib/api/client";
import {
  communityApi,
  type BoardGameApiType,
  type BoardGameResponse,
  type BoardMove,
  type GameDifficulty,
} from "@/lib/api/community";
import {
  ChessPiece,
  describePiece,
  getBoardMoveCoordinates,
  getGoMoveCoordinate,
  getTurnMessageKey,
  isHumanSide,
  pieceSymbol,
  XiangqiPiece,
} from "./board-pieces";
import { DifficultyDisplay, DifficultyPicker, isGameDifficulty } from "./difficulty-controls";

type BoardGameArenaProps = {
  gameType: BoardGameApiType;
  difficulty: GameDifficulty;
  onDifficultyChange: (value: GameDifficulty) => void;
  score: number;
  onScoreChange: (value: number) => void;
  isMember: boolean;
  onCompleted: () => void;
  onActiveChange: (active: boolean) => void;
};

export function BoardGameArena({
  gameType,
  difficulty,
  onDifficultyChange,
  score,
  onScoreChange,
  isMember,
  onCompleted,
  onActiveChange,
}: BoardGameArenaProps) {
  const { t } = useI18n();
  const { confirm } = useDialog();
  const [game, setGame] = useState<BoardGameResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const difficultyRef = useRef(difficulty);
  difficultyRef.current = difficulty;
  const gameRef = useRef<BoardGameResponse | null>(null);
  gameRef.current = game;
  const botTurnInFlight = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [guestScore, setGuestScore] = useState(0);
  const [botThinking, setBotThinking] = useState(false);
  const [botTurnError, setBotTurnError] = useState(false);
  const [showBoardResultAnimation, setShowBoardResultAnimation] = useState(false);
  const [showCheckBanner, setShowCheckBanner] = useState(false);
  const onCompletedRef = useRef(onCompleted);
  onCompletedRef.current = onCompleted;

  // Reset board state cleanly when switching between chess, xiangqi, and go
  useEffect(() => {
    setGame(null);
    setSelectedCell(null);
    setGuestScore(0);
    setBotThinking(false);
    setBotTurnError(false);
    setError("");
    onScoreChange(0);
  }, [gameType, onScoreChange]);

  const titleKey = gameType;
  const title = t(`community.games.${titleKey}.title`);
  const lastMoveCoordinates =
    gameType === "chess" || gameType === "xiangqi"
      ? getBoardMoveCoordinates(game?.state.last_move)
      : null;
  const goLastMove = gameType === "go" ? getGoMoveCoordinate(game?.state.last_move) : null;
  const resumeError = t("community.games.board.resumeError");
  const grid = game?.state.board ?? [];
  const columns = grid[0]?.length ?? 0;
  const won = Boolean(
    game?.state.result.endsWith("_win") &&
      ((gameType === "go" && game.state.result === "black_win") ||
        (gameType === "xiangqi" && game.state.result === "red_win") ||
        (gameType === "chess" && game.state.result === "white_win")),
  );
  const finished = Boolean(game && game.state.result !== "ongoing");

  useEffect(() => {
    onActiveChange(Boolean(game && !finished));
  }, [game, finished, onActiveChange]);

  const inCheck = Boolean(game && !finished && gameType !== "go" && game.state.check);
  const checkedKingChar = inCheck && game ? (game.state.turn === game.state.human ? "K" : "k") : null;

  useEffect(() => {
    if (!inCheck || !game) {
      setShowCheckBanner(false);
      return;
    }
    setShowCheckBanner(true);
    const timeout = window.setTimeout(() => setShowCheckBanner(false), 1850);
    return () => window.clearTimeout(timeout);
  }, [inCheck, game?.state.turn, game?.state.last_move, game]);

  useEffect(() => {
    if (!finished || !game) {
      setShowBoardResultAnimation(false);
      return;
    }
    setShowBoardResultAnimation(true);
    const timeout = window.setTimeout(() => setShowBoardResultAnimation(false), 3400);
    return () => window.clearTimeout(timeout);
  }, [finished, game?.roundId, game?.state.result, game?.state.forfeit, game]);

  useEffect(() => {
    if (!error) return;
    const timeout = window.setTimeout(() => setError(""), 5000);
    return () => window.clearTimeout(timeout);
  }, [error]);

  const runBotTurn = useCallback(
    async (currentGame: BoardGameResponse) => {
      if (botTurnInFlight.current) return;
      botTurnInFlight.current = true;
      setBotThinking(true);
      setBotTurnError(false);
      setIsLoading(true);
      setError("");
      const startedAt = performance.now();
      const minThinkMs = 1000;
      try {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const result = await communityApi.submitBoardBotTurn(
          gameType,
          difficultyRef.current,
          currentGame.roundId,
          currentGame.state,
        );
        const remaining = minThinkMs - (performance.now() - startedAt);
        if (remaining > 0) {
          await new Promise<void>((resolve) => window.setTimeout(resolve, remaining));
        }
        if (!mountedRef.current) return;
        setGame(result);
        onScoreChange(result.score);
        if (result.state.result !== "ongoing") {
          setGuestScore(result.scoreAwarded);
          onCompletedRef.current();
        }
      } catch (err) {
        if (!mountedRef.current) return;
        setBotTurnError(true);
        setError(errorMessage(err, t("community.games.board.botTurnError")));
      } finally {
        botTurnInFlight.current = false;
        setBotThinking(false);
        setIsLoading(false);
      }
    },
    [gameType, onScoreChange, t],
  );

  useEffect(() => {
    if (!isMember || gameRef.current) return;
    let active = true;
    setIsLoading(true);
    void (async () => {
      try {
        const savedGame = await communityApi.getActiveBoardGame(gameType);
        if (!active) return;
        if (!savedGame) {
          setIsLoading(false);
          return;
        }
        setGame(savedGame);
        onScoreChange(savedGame.score);
        const savedDifficulty = savedGame.state.difficulty;
        if (isGameDifficulty(savedDifficulty)) {
          onDifficultyChange(savedDifficulty);
        }
        if (savedGame.state.turn === savedGame.state.ai) {
          await runBotTurn(savedGame);
        } else {
          setIsLoading(false);
        }
      } catch {
        if (active) {
          setError(resumeError);
          setIsLoading(false);
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [gameType, isMember, onDifficultyChange, onScoreChange, resumeError, runBotTurn]);

  async function startGame() {
    setIsLoading(true);
    setError("");
    try {
      const started = await communityApi.startBoardGame(gameType, difficulty);
      setGame(started);
      onScoreChange(started.score);
      setSelectedCell(null);
      setGuestScore(0);
      setBotTurnError(false);
    } catch {
      setError(t("community.games.board.startError"));
    } finally {
      setIsLoading(false);
    }
  }

  async function returnToGameSetup() {
    if (
      !(await confirm({
        title: t("common.confirmTitle"),
        message: t("community.games.board.restartConfirm"),
        confirmLabel: t("common.confirm"),
      }))
    ) {
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      if (isMember) await communityApi.abandonActiveBoardGame(gameType);
      setGame(null);
      onScoreChange(0);
      setSelectedCell(null);
      setGuestScore(0);
      setBotTurnError(false);
    } catch {
      setError(t("community.games.board.abandonError"));
    } finally {
      setIsLoading(false);
    }
  }

  function returnToDifficultySelection() {
    if (!finished) {
      void returnToGameSetup();
      return;
    }
    setGame(null);
    onScoreChange(0);
    setSelectedCell(null);
    setGuestScore(0);
    setBotTurnError(false);
  }

  async function surrenderGame() {
    if (
      !(await confirm({
        title: t("common.confirmTitle"),
        message: t("community.games.board.surrenderConfirm"),
        confirmLabel: t("common.confirm"),
        tone: "danger",
      }))
    ) {
      return;
    }
    if (!game) return;
    setIsLoading(true);
    setError("");
    try {
      const forfeited = await communityApi.forfeitBoardGame(
        gameType,
        isMember ? game.roundId : null,
        game.state,
      );
      setGame(forfeited);
      onScoreChange(forfeited.score);
      setGuestScore(0);
      setSelectedCell(null);
      setBotTurnError(false);
      onCompleted();
    } catch {
      setError(t("community.games.board.abandonError"));
    } finally {
      setIsLoading(false);
    }
  }

  async function sendMove(move: BoardMove) {
    if (!game || isLoading || finished || botTurnError || game.state.turn !== game.state.human) return;
    setIsLoading(true);
    setError("");
    let result: BoardGameResponse;
    try {
      result = await communityApi.submitBoardMove(gameType, difficulty, move, game.roundId, game.state);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 0 && game.roundId) {
        try {
          const savedGame = await communityApi.getActiveBoardGame(gameType);
          if (savedGame?.roundId === game.roundId) {
            setGame(savedGame);
            onScoreChange(savedGame.score);
            setSelectedCell(null);
            if (savedGame.state.turn === savedGame.state.ai) {
              await runBotTurn(savedGame);
              return;
            }
          }
        } catch {
          setError(t("community.games.board.moveInterrupted"));
          setIsLoading(false);
          return;
        }
      }
      setError(
        reason instanceof ApiError && reason.status === 409
          ? t("community.games.board.finishedError")
          : reason instanceof ApiError && reason.status === 0
            ? t("community.games.board.moveInterrupted")
            : game.state.check === true && (gameType === "chess" || gameType === "xiangqi")
              ? t("community.games.board.inCheckIllegalMove")
              : t("community.games.board.illegalMove"),
      );
      setIsLoading(false);
      return;
    }

    setGame(result);
    onScoreChange(result.score);
    setSelectedCell(null);
    if (result.state.result !== "ongoing") {
      setGuestScore(result.scoreAwarded);
      onCompleted();
      setIsLoading(false);
      return;
    }
    await runBotTurn(result);
  }

  function chooseBoardCell(row: number, column: number) {
    if (!game || isLoading || finished || botTurnError || game.state.turn !== game.state.human) return;
    const target = game.state.board[row]?.[column] ?? "";
    const targetOccupied = Boolean(target && target !== "." && target !== "-");
    if (gameType === "go") {
      if (!targetOccupied) void sendMove({ at: [row, column] });
      else setError(t("community.games.board.illegalMove"));
      return;
    }
    if (!selectedCell) {
      if (!targetOccupied || !isHumanSide(gameType, target)) return;
      setSelectedCell([row, column]);
      setError("");
      return;
    }
    if (selectedCell[0] === row && selectedCell[1] === column) {
      setSelectedCell(null);
      return;
    }
    if (targetOccupied && isHumanSide(gameType, target)) {
      setSelectedCell([row, column]);
      setError("");
      return;
    }
    void sendMove({ from: selectedCell, to: [row, column] });
  }

  return (
    <div className="game-play-card board-game-card">
      <div className="game-play-card-header">
        <div>
          <h2>{t(`community.games.${titleKey}.playTitle`)}</h2>
          <p>{t(`community.games.${titleKey}.playDescription`)}</p>
        </div>
        {game && !finished ? (
          <DifficultyDisplay
            value={isGameDifficulty(game.state.difficulty) ? game.state.difficulty : difficulty}
            game={titleKey}
            showReward={false}
          />
        ) : (
          <DifficultyPicker
            value={difficulty}
            onChange={onDifficultyChange}
            game={titleKey}
            disabled={isLoading}
            showReward={false}
          />
        )}
      </div>

      <div className="board-game-points">
        <div className="board-game-stat">
          <span>{t("community.games.score.points", { score: isMember ? score : guestScore })}</span>
        </div>
        <div className="board-game-stat board-game-stat-reward">
          <span>{t(`community.games.${titleKey}.winPoints.${difficulty}`)}</span>
        </div>
      </div>

      {!game ? (
        <div className="game-start-panel game-start-illustrated">
          <div className="game-start-art-frame">
            <GameZoneIllustration slug={gameType} />
          </div>
          <h3>{t(`community.games.${titleKey}.readyTitle`)}</h3>
          <p>{t(`community.games.${titleKey}.readyDescription`)}</p>
          {error ? (
            <div className="game-board-warning game-board-warning-start" role="alert" aria-live="assertive">
              <CircleAlert size={18} aria-hidden="true" />
              <span>{error}</span>
              <button type="button" aria-label={t("common.close")} onClick={() => setError("")}>
                <X size={17} aria-hidden="true" />
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="community-quiz-primary"
            onClick={() => void startGame()}
            disabled={isLoading}
          >
            {isLoading ? <LoaderCircle className="ui-spin" size={16} /> : <Gamepad2 size={16} />}
            {t("community.games.board.start")}
          </button>
        </div>
      ) : (
        <>
          <p
            className={`board-game-turn${finished ? " board-game-result-message" : ""}${
              inCheck ? " is-in-check" : ""
            }${botThinking ? " is-thinking" : ""}`}
            role="status"
            aria-live="polite"
          >
            {finished ? (
              t(
                won
                  ? "community.games.board.youWon"
                  : game.state.result === "draw"
                    ? "community.games.board.draw"
                    : "community.games.board.youLost",
              )
            ) : botThinking ? (
              <>
                <LoaderCircle className="ui-spin" size={14} aria-hidden="true" />
                {t("community.games.board.botThinking")}
              </>
            ) : (
              <>
                {t("community.games.board.turn", {
                  turn: t(getTurnMessageKey(gameType, game.state.turn)),
                })}
                {inCheck ? <span className="board-check-pill">{t("community.games.board.checkAlert")}</span> : null}
              </>
            )}
          </p>

          {botTurnError ? (
            <button
              type="button"
              className="community-quiz-primary board-game-pass"
              disabled={isLoading}
              onClick={() => void runBotTurn(game)}
            >
              <RotateCcw size={16} /> {t("community.games.board.retryBot")}
            </button>
          ) : null}

          <div className="board-game-stage">
            {error ? (
              <div className="game-board-warning" role="alert" aria-live="assertive">
                <CircleAlert size={18} aria-hidden="true" />
                <span>{error}</span>
                <button type="button" aria-label={t("common.close")} onClick={() => setError("")}>
                  <X size={17} aria-hidden="true" />
                </button>
              </div>
            ) : null}

            <div className={`board-game-surface board-game-surface-${gameType}`}>
              <div
                className={`board-game-board board-game-${gameType}${inCheck ? " board-in-check" : ""}`}
                style={
                  gameType === "go" || gameType === "xiangqi"
                    ? undefined
                    : { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
                }
                role="grid"
                aria-label={title}
              >
                {gameType === "xiangqi" ? (
                  <div className="xiangqi-river" aria-hidden="true">
                    <span>楚河</span>
                    <span>漢界</span>
                  </div>
                ) : null}

                {grid.flatMap((row, rowIndex) =>
                  row.map((piece, columnIndex) => {
                    const isSelected = selectedCell?.[0] === rowIndex && selectedCell[1] === columnIndex;
                    const isOccupied = Boolean(piece && piece !== "." && piece !== "-");
                    const isLastMovedPiece = Boolean(
                      lastMoveCoordinates &&
                        lastMoveCoordinates.to[0] === rowIndex &&
                        lastMoveCoordinates.to[1] === columnIndex &&
                        isOccupied,
                    );
                    const isLastMoveOrigin = Boolean(
                      lastMoveCoordinates &&
                        lastMoveCoordinates.from[0] === rowIndex &&
                        lastMoveCoordinates.from[1] === columnIndex,
                    );
                    const isGoLastMove = Boolean(
                      goLastMove && goLastMove[0] === rowIndex && goLastMove[1] === columnIndex && isOccupied,
                    );
                    const isKingInCheck = Boolean(checkedKingChar && piece === checkedKingChar);
                    const squareTone = (rowIndex + columnIndex) % 2 === 0 ? " square-light" : " square-dark";
                    const sideClass =
                      isOccupied && gameType !== "go"
                        ? piece === piece.toUpperCase()
                          ? " piece-light-side"
                          : " piece-dark-side"
                        : "";
                    return (
                      <button
                        type="button"
                        role="gridcell"
                        key={`${rowIndex}-${columnIndex}`}
                        className={`board-game-square${gameType === "chess" ? squareTone : ""}${
                          isSelected ? " selected" : ""
                        }${isOccupied ? " occupied" : ""}${sideClass}${
                          isLastMovedPiece ? " piece-move-active piece-move-target" : ""
                        }${isLastMoveOrigin ? " piece-move-origin" : ""}${
                          isKingInCheck ? " in-check-king" : ""
                        }${isGoLastMove ? " go-last-move" : ""}${
                          gameType === "go" && isOccupied ? ` stone-${piece.toLowerCase()}` : ""
                        }`}
                        aria-label={t("community.games.board.cell", {
                          row: rowIndex + 1,
                          column: columnIndex + 1,
                          piece: describePiece(gameType, piece, t),
                        })}
                        onClick={() => chooseBoardCell(rowIndex, columnIndex)}
                        disabled={
                          isLoading || finished || botTurnError || game.state.turn !== game.state.human
                        }
                        style={
                          gameType === "go"
                            ? {
                                left: `${5.5556 + columnIndex * 11.1111}%`,
                                top: `${5.5556 + rowIndex * 11.1111}%`,
                              }
                            : gameType === "xiangqi"
                              ? {
                                  left: `${6.25 + columnIndex * 10.9375}%`,
                                  top: `${5.5556 + rowIndex * 9.8765}%`,
                                }
                              : undefined
                        }
                      >
                        {gameType === "chess" && columnIndex === 0 ? (
                          <span className="chess-coord chess-coord-rank" aria-hidden="true">
                            {8 - rowIndex}
                          </span>
                        ) : null}
                        {gameType === "chess" && rowIndex === 7 ? (
                          <span className="chess-coord chess-coord-file" aria-hidden="true">
                            {String.fromCharCode(97 + columnIndex)}
                          </span>
                        ) : null}
                        {gameType === "go" ? null : isOccupied ? (
                          <span
                            className={
                              isLastMovedPiece ? "board-game-piece-motion" : "board-game-piece-static"
                            }
                            style={
                              isLastMovedPiece && lastMoveCoordinates
                                ? ({
                                    "--piece-move-x": `${(lastMoveCoordinates.from[1] - columnIndex) * 100}%`,
                                    "--piece-move-y": `${(lastMoveCoordinates.from[0] - rowIndex) * 100}%`,
                                  } as CSSProperties)
                                : undefined
                            }
                          >
                            {gameType === "chess" ? (
                              <ChessPiece piece={piece} />
                            ) : gameType === "xiangqi" ? (
                              <XiangqiPiece piece={piece} />
                            ) : (
                              pieceSymbol(piece)
                            )}
                          </span>
                        ) : null}
                      </button>
                    );
                  }),
                )}
              </div>

              {showCheckBanner && inCheck ? (
                <div className="board-check-banner" aria-hidden="true">
                  <span>{t("community.games.board.checkAlert")}</span>
                </div>
              ) : null}

              {showBoardResultAnimation && finished ? (
                <div
                  className={`board-game-result-overlay${
                    won ? " board-game-result-victory" : " board-game-result-game-over"
                  }`}
                  aria-hidden="true"
                >
                  <Lottie
                    src={won ? trophyAnimation : gameOverAnimation}
                    autoplay
                    loop={false}
                    className="board-game-result-lottie"
                  />
                </div>
              ) : null}
            </div>
          </div>

          <div className="board-game-replay-row">
            {!finished ? (
              <button
                type="button"
                className="community-quiz-secondary board-game-surrender"
                onClick={() => void surrenderGame()}
                disabled={isLoading}
              >
                <Flag size={16} /> {t("community.games.board.surrender")}
              </button>
            ) : null}
            {finished ? (
              <>
                <button
                  type="button"
                  className="community-quiz-primary board-game-replay"
                  disabled={isLoading}
                  onClick={() => void startGame()}
                >
                  <Gamepad2 size={18} /> {t("community.games.board.newGame")}
                </button>
                <button
                  type="button"
                  className="community-quiz-secondary board-game-replay"
                  disabled={isLoading}
                  onClick={returnToDifficultySelection}
                >
                  <ArrowLeft size={16} /> {t("community.games.board.back")}
                </button>
              </>
            ) : (
              <button
                type="button"
                className="community-quiz-secondary board-game-replay"
                disabled={isLoading}
                onClick={() => void returnToGameSetup()}
              >
                <ArrowLeft size={16} /> {t("community.games.board.back")}
              </button>
            )}
          </div>

          {gameType === "go" && !finished ? (
            <button
              type="button"
              className="community-quiz-primary board-game-pass"
              disabled={isLoading || botThinking || game.state.turn !== game.state.human}
              onClick={() => void sendMove({ pass: true })}
            >
              {t("community.games.go.pass")}
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
