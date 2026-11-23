"use client";

import { Activity, Armchair, ArrowUpRight, BicepsFlexed, Clock3, Footprints, Hand, HeartPulse, ShieldCheck, UserRoundArrowLeft, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ExerciseAnimation } from "@/components/training/exercise-animation";
import { useI18n } from "@/i18n/i18n-provider";
import { exerciseGroups, exercises, sortExercisesByLevel, type Exercise, type ExerciseGroup, type ExerciseRegion } from "@/lib/training";

const regionIcons = {
  shoulders: Activity,
  arms: Hand,
  legs: Footprints,
  whole: HeartPulse,
} satisfies Record<ExerciseRegion, typeof Activity>;

const groupIcons: Partial<Record<ExerciseGroup, LucideIcon>> = {
  neckShoulders: UserRoundArrowLeft,
  wholeBody: BicepsFlexed,
};

/** Render the public exercise catalogue and open illustrations on demand. */
export function TrainingLibrary() {
  const { locale, t } = useI18n();
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  return (
    <AppShell currentPage="training">
      <div className="training-page">
        <section className="training-hero">
          <div>
            <p className="training-kicker">{t("training.kicker")}</p>
            <h1>{t("training.title")}</h1>
            <p>{t("training.intro")}</p>
          </div>
          <div className="training-hero-icon" aria-hidden="true"><HeartPulse size={72} strokeWidth={1.3} /></div>
        </section>

        <aside className="training-safety">
          <ShieldCheck size={22} aria-hidden="true" />
          <p>{t("training.safety")}</p>
        </aside>

        <section aria-label={t("nav.training")} className="training-results">
          {exerciseGroups.map((group) => (
            <section key={group} className="training-group" aria-labelledby={`training-group-${group}`}>
              <h2 id={`training-group-${group}`}>{t(`training.groups.${group}`)}</h2>
              <div className="training-grid">
                {sortExercisesByLevel(exercises.filter((exercise) => exercise.group === group)).map((exercise) => {
                  const Icon = groupIcons[exercise.group] ?? regionIcons[exercise.region];
                  const content = exercise.text[locale];
                  return (
                    <article className="training-card" key={exercise.id}>
                      <div className="training-card-top">
                        <div className="training-card-icon" aria-hidden="true"><Icon size={28} strokeWidth={1.7} /></div>
                        <span className="training-level">{t(`training.level${exercise.level}`)}</span>
                      </div>
                      <h3>{content.title}</h3>
                      <div className="training-meta">
                        <span><Clock3 size={15} aria-hidden="true" /> {t("training.minutes", { count: exercise.minutes })}</span>
                        <span><Armchair size={15} aria-hidden="true" /> {t(exercise.position === "seated" ? "training.seated" : "training.standing")}</span>
                      </div>
                      <button type="button" className="training-guide-button" aria-haspopup="dialog" onClick={() => setSelectedExercise(exercise)}>
                        {t("training.show")} <ArrowUpRight size={16} aria-hidden="true" />
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </section>
        {selectedExercise && <ExerciseAnimation exercise={selectedExercise} onClose={() => setSelectedExercise(null)} />}
      </div>
    </AppShell>
  );
}
