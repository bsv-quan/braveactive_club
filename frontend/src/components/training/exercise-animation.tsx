"use client";

import { Pause, Play, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ExerciseIllustration } from "@/components/training/exercise-illustration";
import { useI18n } from "@/i18n/i18n-provider";
import type { Exercise } from "@/lib/training";

/** Present a keyboard-accessible native modal with a pausable movement illustration. */
export function ExerciseAnimation({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const { locale, t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [paused, setPaused] = useState(false);
  const content = exercise.text[locale];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="training-dialog"
      aria-labelledby="training-dialog-title"
      aria-describedby="training-dialog-description"
      onClose={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          dialogRef.current?.close();
        }
      }}
    >
      <div className="training-dialog-header">
        <h2 id="training-dialog-title">{content.title}</h2>
        <button type="button" className="ui-icon-button" aria-label={t("common.close")} onClick={() => dialogRef.current?.close()}><X size={20} aria-hidden="true" /></button>
      </div>
      <p id="training-dialog-description">{t("training.animationDescription")}</p>
      <div className={`training-illustration${paused ? " paused" : ""}`}>
        <ExerciseIllustration id={exercise.id} label={content.title} />
        <button type="button" className="training-animation-toggle" aria-label={t(paused ? "training.play" : "training.pause")} title={t(paused ? "training.play" : "training.pause")} onClick={() => setPaused((current) => !current)}>
          {paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />}
        </button>
      </div>
      <div className="training-dialog-steps">
        <p><strong>{t("training.equipment")}:</strong> {content.equipment}</p>
        <h3>{t("training.steps")}</h3>
        <ol>{content.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        <p><strong>{t("training.note")}:</strong> {content.note}</p>
      </div>
    </dialog>
  );
}
