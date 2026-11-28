"use client";

import {
  Armchair,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Pause,
  PersonStanding,
  Play,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Timer,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ExerciseIllustration } from "@/components/training/exercise-illustration";
import { useI18n } from "@/i18n/i18n-provider";
import type { Exercise } from "@/lib/training";

export type GuidedRoutineState = {
  title: string;
  items: Exercise[];
  index: number;
  onSelectIndex: (index: number) => void;
};

type ExerciseAnimationProps = {
  exercise: Exercise;
  routine?: GuidedRoutineState | null;
  onClose: () => void;
};

/** Present a keyboard-accessible native modal with a pausable movement illustration, workday break timer, and routine stepper. */
export function ExerciseAnimation({ exercise, routine = null, onClose }: ExerciseAnimationProps) {
  const { locale, t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const totalSeconds = exercise.minutes * 60;
  const [prevExerciseId, setPrevExerciseId] = useState(exercise.id);
  const [paused, setPaused] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(totalSeconds);
  const [timerRunning, setTimerRunning] = useState(false);

  if (prevExerciseId !== exercise.id) {
    setPrevExerciseId(exercise.id);
    setPaused(false);
    setRemainingSeconds(totalSeconds);
    setTimerRunning(false);
  }

  const content = exercise.text[locale];
  const PostureIcon = exercise.position === "seated" ? Armchair : PersonStanding;

  useEffect(() => {
    if (!timerRunning) return;
    const interval = window.setInterval(() => {
      setRemainingSeconds((current) => {
        if (current <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [timerRunning]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();

    if (!("closedBy" in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const isOutside = (event: PointerEvent) => {
        const rect = dialog.getBoundingClientRect();
        return (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        );
      };
      const handlePointerDown = (event: PointerEvent) => {
        pressedOutside = isOutside(event);
      };
      const handlePointerUp = (event: PointerEvent) => {
        if (pressedOutside && isOutside(event)) dialog.close();
      };
      dialog.addEventListener("pointerdown", handlePointerDown);
      dialog.addEventListener("pointerup", handlePointerUp);
      return () => {
        dialog.removeEventListener("pointerdown", handlePointerDown);
        dialog.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, []);

  const minutesPart = String(Math.floor(remainingSeconds / 60)).padStart(2, "0");
  const secondsPart = String(remainingSeconds % 60).padStart(2, "0");
  const isTimerDone = remainingSeconds === 0;
  const hasTimerStarted = remainingSeconds < totalSeconds;
  const progressPercent =
    totalSeconds > 0 ? Math.round(((totalSeconds - remainingSeconds) / totalSeconds) * 100) : 0;
  const hasRoutine = Boolean(routine && routine.items.length > 1);
  const isLastRoutineStep = routine ? routine.index >= routine.items.length - 1 : false;

  function handleToggleTimer() {
    if (timerRunning) {
      setTimerRunning(false);
      return;
    }
    if (isTimerDone) {
      setRemainingSeconds(totalSeconds);
    }
    setTimerRunning(true);
  }

  function handleResetTimer() {
    setTimerRunning(false);
    setRemainingSeconds(totalSeconds);
  }

  return (
    <dialog
      ref={dialogRef}
      className="training-dialog"
      {...({ closedby: "any" } as Record<string, string>)}
      aria-labelledby="training-dialog-title"
      aria-describedby="training-dialog-description"
      onClose={onClose}
    >
      {hasRoutine && routine ? (
        <div className="training-routine-strip">
          <div className="training-routine-strip-top">
            <span className="training-routine-strip-title">{routine.title}</span>
            <span className="training-routine-strip-count">
              {t("training.timer.stepProgress", {
                current: routine.index + 1,
                total: routine.items.length,
              })}
            </span>
          </div>
          <div className="training-routine-pills">
            {routine.items.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                className={`training-routine-pill${idx === routine.index ? " is-active" : ""}`}
                aria-current={idx === routine.index ? "step" : undefined}
                onClick={() => routine.onSelectIndex(idx)}
              >
                <span className="training-routine-pill-num">{idx + 1}</span>
                <span className="training-routine-pill-label">{item.text[locale].title}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="training-dialog-header">
        <div className="training-dialog-title-group">
          <div className="training-dialog-badges">
            <span className={`training-level-pill level-${exercise.level}`}>
              {t(`training.level${exercise.level}`)}
            </span>
            <span className="training-dialog-badge">
              <Clock3 size={12} aria-hidden="true" />{" "}
              {t("training.minutes", { count: exercise.minutes })}
            </span>
            <span className="training-dialog-badge">
              <PostureIcon size={12} aria-hidden="true" />{" "}
              {t(exercise.position === "seated" ? "training.seated" : "training.standing")}
            </span>
          </div>
          <h1 id="training-dialog-title">{content.title}</h1>
        </div>
        <button
          type="button"
          className="ui-icon-button"
          aria-label={t("common.close")}
          onClick={() => dialogRef.current?.close()}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <p id="training-dialog-description" className="training-dialog-lead">
        {t("training.animationDescription")}
      </p>

      <div className="training-timer-card">
        <div className="training-timer-main">
          <div className="training-timer-readout">
            <Timer size={18} aria-hidden="true" />
            <span className="training-timer-clock">
              {minutesPart}:{secondsPart}
            </span>
          </div>
          <div className="training-timer-actions">
            <button
              type="button"
              autoFocus
              className={`ui-button ${timerRunning ? "ui-button-secondary" : "ui-button-primary"} ui-button-sm`}
              onClick={handleToggleTimer}
            >
              {timerRunning ? (
                <>
                  <Pause size={14} aria-hidden="true" /> {t("training.timer.pause")}
                </>
              ) : (
                <>
                  <Play size={14} aria-hidden="true" />{" "}
                  {t(hasTimerStarted && !isTimerDone ? "training.timer.resume" : "training.timer.start")}
                </>
              )}
            </button>
            {hasTimerStarted || timerRunning ? (
              <button
                type="button"
                className="ui-button ui-button-ghost ui-button-sm"
                onClick={handleResetTimer}
              >
                <RotateCcw size={14} aria-hidden="true" /> {t("training.timer.reset")}
              </button>
            ) : null}
          </div>
        </div>
        <div className="training-timer-bar" aria-hidden="true">
          <span style={{ width: `${progressPercent}%` }} />
        </div>
        {isTimerDone ? (
          <p className="training-timer-done" role="status">
            <CheckCircle2 size={15} aria-hidden="true" /> {t("training.timer.done")}
          </p>
        ) : null}
      </div>

      <div className={`training-illustration${paused ? " paused" : ""}`}>
        <ExerciseIllustration id={exercise.id} label={content.title} />
        <button
          type="button"
          className="training-animation-toggle"
          aria-label={t(paused ? "training.play" : "training.pause")}
          title={t(paused ? "training.play" : "training.pause")}
          onClick={() => setPaused((current) => !current)}
        >
          {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
        </button>
      </div>

      <div className="training-dialog-steps">
        <div className="training-dialog-callout is-prep">
          <Sparkles size={15} aria-hidden="true" />
          <p>
            <strong>{t("training.equipment")}:</strong> {content.equipment}
          </p>
        </div>

        <h2>{t("training.steps")}</h2>
        <ol className="training-step-list">
          {content.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>

        <div className="training-dialog-callout is-safety">
          <ShieldCheck size={16} aria-hidden="true" />
          <p>
            <strong>{t("training.note")}:</strong> {content.note}
          </p>
        </div>
      </div>

      {hasRoutine && routine ? (
        <div className="training-routine-nav">
          <button
            type="button"
            className="ui-button ui-button-secondary ui-button-sm"
            disabled={routine.index === 0}
            onClick={() => routine.onSelectIndex(routine.index - 1)}
          >
            <ArrowLeft size={15} aria-hidden="true" /> {t("training.timer.prevMovement")}
          </button>
          {isLastRoutineStep ? (
            <button
              type="button"
              className="ui-button ui-button-primary ui-button-sm"
              onClick={() => dialogRef.current?.close()}
            >
              <CheckCircle2 size={15} aria-hidden="true" /> {t("training.timer.finishRoutine")}
            </button>
          ) : (
            <button
              type="button"
              className="ui-button ui-button-primary ui-button-sm"
              onClick={() => routine.onSelectIndex(routine.index + 1)}
            >
              {t("training.timer.nextMovement")} <ArrowRight size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      ) : null}
    </dialog>
  );
}
