"use client";

import { Activity, Armchair, ArrowRight, ArrowUpRight, BicepsFlexed, Clock3, Footprints, Hand, HeartPulse, ShieldCheck, Sparkles, UserRoundArrowLeft, type LucideIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ExerciseAnimation } from "@/components/training/exercise-animation";
import { useI18n } from "@/i18n/i18n-provider";
import { exerciseGroups, exercises, sortExercisesByLevel, type Exercise, type ExerciseGroup, type ExerciseId, type ExerciseRegion } from "@/lib/training";

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

const QUICK_BREAK_PICKS: { id: ExerciseId; tone: "is-teal" | "is-sky" | "is-energy" }[] = [
  { id: "neck-side-tilt", tone: "is-teal" },
  { id: "wrist-circles", tone: "is-sky" },
  { id: "standing-arm-stretch", tone: "is-energy" },
];

/** Render the public exercise catalogue (Quick Break Routine — Variant T2). */
export function TrainingLibrary() {
  const { locale, t } = useI18n();
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);

  const quickBreakExercises = useMemo(
    () =>
      QUICK_BREAK_PICKS.map((pick) => {
        const exercise = exercises.find((item) => item.id === pick.id);
        return exercise ? { exercise, tone: pick.tone } : null;
      }).filter((item): item is { exercise: Exercise; tone: "is-teal" | "is-sky" | "is-energy" } => item !== null),
    [],
  );

  return (
    <AppShell currentPage="training">
      <div className="training-page training-v2">
        <header className="training-masthead">
          <span className="community-masthead-kicker">{t("training.kicker")}</span>
          <h1>{t("training.title")}</h1>
          <p>{t("training.intro")}</p>
        </header>

        <section className="training-quick-breaks" aria-labelledby="training-quick-break-heading">
          <div className="training-section-head">
            <h2 id="training-quick-break-heading">
              <Sparkles size={17} aria-hidden="true" /> {t("training.quickBreakHeading")}
            </h2>
          </div>
          <div className="training-quick-grid">
            {quickBreakExercises.map(({ exercise, tone }) => {
              const Icon = groupIcons[exercise.group] ?? regionIcons[exercise.region];
              const content = exercise.text[locale];
              return (
                <button
                  key={exercise.id}
                  type="button"
                  className={`training-quick-card ${tone}`}
                  aria-haspopup="dialog"
                  onClick={() => setSelectedExercise(exercise)}
                >
                  <div className="training-quick-top">
                    <span className="training-quick-icon" aria-hidden="true">
                      <Icon size={22} strokeWidth={1.8} />
                    </span>
                    <span className="training-quick-meta">
                      <Clock3 size={13} aria-hidden="true" /> {t("training.minutes", { count: exercise.minutes })}
                      {" · "}
                      {t(exercise.position === "seated" ? "training.seated" : "training.standing")}
                    </span>
                  </div>
                  <strong>{content.title}</strong>
                  <span className="training-quick-prep">{content.steps[0]}</span>
                  <span className="training-quick-cta">
                    {t("training.quickBreakCta")} <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <aside className="training-safety training-safety-compact">
          <ShieldCheck size={19} aria-hidden="true" />
          <p>{t("training.safety")}</p>
        </aside>

        <section aria-label={t("nav.training")} className="training-results">
          {exerciseGroups.map((group) => (
            <section key={group} className="training-group" aria-labelledby={`training-group-${group}`}>
              <h2 id={`training-group-${group}`}>{t(`training.groups.${group}`)}</h2>
              <div className="training-row-grid">
                {sortExercisesByLevel(exercises.filter((exercise) => exercise.group === group)).map((exercise) => {
                  const Icon = groupIcons[exercise.group] ?? regionIcons[exercise.region];
                  const content = exercise.text[locale];
                  return (
                    <article className="training-row-card" key={exercise.id}>
                      <div className="training-row-icon" aria-hidden="true">
                        <Icon size={22} strokeWidth={1.7} />
                      </div>
                      <div className="training-row-body">
                        <div className="training-row-head">
                          <h3>{content.title}</h3>
                          <span className={`training-level-pill level-${exercise.level}`}>
                            {t(`training.level${exercise.level}`)}
                          </span>
                        </div>
                        <div className="training-meta">
                          <span><Clock3 size={14} aria-hidden="true" /> {t("training.minutes", { count: exercise.minutes })}</span>
                          <span><Armchair size={14} aria-hidden="true" /> {t(exercise.position === "seated" ? "training.seated" : "training.standing")}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="training-row-action"
                        aria-haspopup="dialog"
                        aria-label={`${t("training.show")}: ${content.title}`}
                        onClick={() => setSelectedExercise(exercise)}
                      >
                        <span>{t("training.show")}</span>
                        <ArrowUpRight size={15} aria-hidden="true" />
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
