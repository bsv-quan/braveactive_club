"use client";

import {
  Activity,
  Armchair,
  ArrowRight,
  ArrowUpRight,
  BicepsFlexed,
  Clock3,
  Footprints,
  Hand,
  HeartPulse,
  ListChecks,
  type LucideIcon,
  PersonStanding,
  RotateCcw,
  Search,
  ShieldCheck,
  Shuffle,
  Sparkles,
  UserRoundArrowLeft,
  X,
} from "lucide-react";
import { useId, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { ExerciseAnimation } from "@/components/training/exercise-animation";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n/i18n-provider";
import { foldSearchText } from "@/lib/community-filters";
import {
  exerciseGroups,
  exercises,
  filterExercises,
  initialExerciseFilters,
  sortExercisesByLevel,
  type Exercise,
  type ExerciseFilters,
  type ExerciseGroup,
  type ExerciseId,
  type ExerciseLevel,
  type ExercisePosition,
  type ExerciseRegion,
} from "@/lib/training";

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

type WorkdayRoutineKey = "neckFocus" | "wristFocus" | "afternoonBoost";

const WORKDAY_ROUTINES: {
  key: WorkdayRoutineKey;
  tone: "is-teal" | "is-sky" | "is-energy";
  icon: LucideIcon;
  ids: ExerciseId[];
}[] = [
  {
    key: "neckFocus",
    tone: "is-teal",
    icon: UserRoundArrowLeft,
    ids: ["shoulder-lifts", "neck-side-tilt", "chin-tuck"],
  },
  {
    key: "wristFocus",
    tone: "is-sky",
    icon: Hand,
    ids: ["wrist-circles", "shoulder-blades", "elbow-bends"],
  },
  {
    key: "afternoonBoost",
    tone: "is-energy",
    icon: BicepsFlexed,
    ids: ["sit-to-stand", "march-in-place", "standing-arm-stretch"],
  },
];

/** Render the workday movement hub with Editorial Folio masthead, guided scenario routines, 1-minute random break, and instant discovery. */
export function TrainingLibrary() {
  const { locale, t } = useI18n();
  const searchInputId = useId();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const lastRandomIdRef = useRef<ExerciseId | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [activeRoutine, setActiveRoutine] = useState<{
    key: WorkdayRoutineKey;
    items: Exercise[];
    index: number;
  } | null>(null);
  const [filters, setFilters] = useState<ExerciseFilters>(initialExerciseFilters);
  const [searchQuery, setSearchQuery] = useState("");

  const workdayRoutines = useMemo(
    () =>
      WORKDAY_ROUTINES.map((routine) => {
        const items = routine.ids
          .map((id) => exercises.find((exercise) => exercise.id === id))
          .filter((item): item is Exercise => item !== undefined);
        const totalMinutes = items.reduce((sum, item) => sum + item.minutes, 0);
        return { ...routine, items, totalMinutes };
      }).filter((routine) => routine.items.length > 0),
    [],
  );

  function openSingleMovement(exercise: Exercise) {
    setActiveRoutine(null);
    setSelectedExercise(exercise);
  }

  function openWorkdayRoutine(key: WorkdayRoutineKey, items: Exercise[]) {
    if (items.length === 0) return;
    setSelectedExercise(null);
    setActiveRoutine({ key, items, index: 0 });
  }

  function openRandomOneMinuteBreak() {
    const oneMinutePool = exercises.filter((item) => item.minutes <= 1);
    const pool = oneMinutePool.length > 0 ? oneMinutePool : exercises;
    const candidates =
      pool.length > 1 ? pool.filter((item) => item.id !== lastRandomIdRef.current) : pool;
    const picked = candidates[Math.floor(Math.random() * candidates.length)] ?? pool[0];
    if (!picked) return;
    lastRandomIdRef.current = picked.id;
    openSingleMovement(picked);
  }

  function closeMovementModal() {
    setSelectedExercise(null);
    setActiveRoutine(null);
  }

  const visibleExercises = useMemo(() => {
    const byCriteria = filterExercises(exercises, filters);
    const trimmed = searchQuery.trim();
    if (!trimmed) return byCriteria;
    const tokens = trimmed.split(/\s+/).filter(Boolean).slice(0, 6);
    return byCriteria.filter((exercise) => {
      const content = exercise.text[locale];
      const rawHaystack = [content.title, content.equipment, content.note, ...content.steps]
        .join(" ")
        .toLowerCase();
      const foldedHaystack = foldSearchText(rawHaystack);
      return tokens.every((token) => {
        const lowered = token.toLowerCase();
        const isAscii = [...lowered].every((ch) => ch.charCodeAt(0) <= 127);
        return isAscii
          ? foldedHaystack.includes(foldSearchText(lowered))
          : rawHaystack.includes(lowered);
      });
    });
  }, [filters, locale, searchQuery]);

  const hasActiveFilter =
    filters.position !== "all" ||
    filters.region !== "all" ||
    filters.level !== "all" ||
    filters.duration !== "all" ||
    searchQuery.trim().length > 0;

  function resetFilters() {
    setFilters(initialExerciseFilters);
    setSearchQuery("");
  }

  const postureOptions: { value: ExercisePosition | "all"; label: string }[] = [
    { value: "all", label: t("training.all") },
    { value: "seated", label: t("training.seated") },
    { value: "standing", label: t("training.standing") },
  ];

  const levelOptions: { value: ExerciseLevel | "all"; label: string }[] = [
    { value: "all", label: t("training.all") },
    { value: 1, label: t("training.level1") },
    { value: 2, label: t("training.level2") },
    { value: 3, label: t("training.level3") },
  ];

  const durationOptions: { value: ExerciseFilters["duration"]; label: string }[] = [
    { value: "all", label: t("training.all") },
    { value: "short", label: t("training.short") },
    { value: "longer", label: t("training.longer") },
  ];

  const modalExercise = activeRoutine
    ? activeRoutine.items[activeRoutine.index] ?? null
    : selectedExercise;

  return (
    <AppShell currentPage="training">
      <div className="training-page training-v2">
        <header className="editorial-folio-masthead training-masthead">
          <div className="editorial-folio-top">
            <div className="community-dateline">
              <span className="community-edition-tag">{t("training.kicker")}</span>
              <span className="editorial-folio-stat">
                <Activity size={13} aria-hidden="true" />
                {t("training.catalogSummary", { count: exercises.length })}
              </span>
            </div>
          </div>
          <div className="editorial-folio-main">
            <div className="editorial-folio-copy">
              <h1>{t("training.title")}</h1>
              <p>{t("training.intro")}</p>
            </div>
            <button
              type="button"
              className="ui-button ui-button-primary editorial-folio-cta"
              aria-haspopup="dialog"
              onClick={openRandomOneMinuteBreak}
            >
              <Shuffle size={16} aria-hidden="true" /> {t("training.randomBreak")}
            </button>
          </div>
        </header>

        <section className="training-quick-breaks" aria-labelledby="training-quick-break-heading">
          <div className="training-section-head">
            <h2 id="training-quick-break-heading">
              <Sparkles size={17} aria-hidden="true" /> {t("training.quickBreakHeading")}
            </h2>
          </div>
          <div className="training-quick-grid">
            {workdayRoutines.map(({ key, tone, icon: Icon, items, totalMinutes }) => (
              <button
                key={key}
                type="button"
                className={`training-quick-card ${tone}`}
                aria-haspopup="dialog"
                onClick={() => openWorkdayRoutine(key, items)}
              >
                <div className="training-quick-top">
                  <span className="training-quick-icon" aria-hidden="true">
                    <Icon size={22} strokeWidth={1.8} />
                  </span>
                  <div className="training-quick-badges">
                    <span className="training-routine-scenario-badge">
                      {t(`training.routines.${key}.badge`)}
                    </span>
                    <span className="training-quick-meta">
                      <Clock3 size={12} aria-hidden="true" />{" "}
                      {t("training.minutes", { count: totalMinutes })}
                      {" · "}
                      {t("training.movementsCount", { count: items.length })}
                    </span>
                  </div>
                </div>
                <strong>{t(`training.routines.${key}.title`)}</strong>
                <span className="training-quick-prep">{t(`training.routines.${key}.desc`)}</span>
                <span className="training-routine-preview">
                  {items.map((item, idx) => (
                    <span key={item.id} className="training-routine-chip">
                      {idx + 1}. {item.text[locale].title}
                    </span>
                  ))}
                </span>
                <span className="training-quick-cta">
                  {t("training.quickBreakCta")} <ArrowRight size={14} aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>
        </section>

        <aside className="training-safety training-safety-compact">
          <ShieldCheck size={19} aria-hidden="true" />
          <p>{t("training.safety")}</p>
        </aside>

        <search className="community-discovery training-discovery" aria-label={t("training.filters")}>
          <form className="community-search-form" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor={searchInputId} className="community-sr-only">
              {t("training.searchPlaceholder")}
            </label>
            <span className="community-search-icon" aria-hidden="true">
              <Search size={16} />
            </span>
            <input
              ref={searchInputRef}
              id={searchInputId}
              className="community-search-input"
              type="search"
              name="q"
              value={searchQuery}
              maxLength={80}
              placeholder={t("training.searchPlaceholder")}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="search"
              onChange={(event) => setSearchQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                if (event.key === "Escape" && searchQuery) {
                  event.preventDefault();
                  setSearchQuery("");
                }
              }}
            />
            {searchQuery ? (
              <button
                type="button"
                className="community-search-clear"
                aria-label={t("training.clearSearch")}
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
              >
                <X size={15} aria-hidden="true" />
              </button>
            ) : null}
          </form>

          <div className="training-filter-deck">
            <div className="training-filter-group" role="group" aria-label={t("training.posture")}>
              <span className="training-filter-label">{t("training.posture")}:</span>
              {postureOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={filters.position === option.value}
                  className={`training-filter-chip${filters.position === option.value ? " is-active" : ""}`}
                  onClick={() => setFilters((current) => ({ ...current, position: option.value }))}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="training-filter-group" role="group" aria-label={t("training.level")}>
              <span className="training-filter-label">{t("training.level")}:</span>
              {levelOptions.map((option) => (
                <button
                  key={String(option.value)}
                  type="button"
                  aria-pressed={filters.level === option.value}
                  className={`training-filter-chip${filters.level === option.value ? " is-active" : ""}`}
                  onClick={() => setFilters((current) => ({ ...current, level: option.value }))}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="training-filter-group" role="group" aria-label={t("training.duration")}>
              <span className="training-filter-label">{t("training.duration")}:</span>
              {durationOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={filters.duration === option.value}
                  className={`training-filter-chip${filters.duration === option.value ? " is-active" : ""}`}
                  onClick={() => setFilters((current) => ({ ...current, duration: option.value }))}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {hasActiveFilter ? (
              <button type="button" className="community-filter-reset-inline" onClick={resetFilters}>
                <RotateCcw size={13} aria-hidden="true" /> {t("training.reset")}
              </button>
            ) : null}
          </div>
        </search>

        {visibleExercises.length === 0 ? (
          <div className="feed-empty-card">
            <span className="feed-empty-icon" aria-hidden="true">
              <Activity size={24} />
            </span>
            <strong>{t("training.empty")}</strong>
            <Button variant="secondary" size="sm" icon={RotateCcw} onClick={resetFilters}>
              {t("training.reset")}
            </Button>
          </div>
        ) : (
          <section aria-label={t("nav.training")} className="training-results">
            {exerciseGroups.map((group) => {
              const groupItems = sortExercisesByLevel(
                visibleExercises.filter((exercise) => exercise.group === group),
              );
              if (groupItems.length === 0) return null;
              return (
                <section key={group} className="training-group" aria-labelledby={`training-group-${group}`}>
                  <div className="training-group-head">
                    <h2 id={`training-group-${group}`}>{t(`training.groups.${group}`)}</h2>
                    <span className="training-group-count">{groupItems.length}</span>
                  </div>
                  <div className="training-row-grid">
                    {groupItems.map((exercise) => {
                      const Icon = groupIcons[exercise.group] ?? regionIcons[exercise.region];
                      const PostureIcon = exercise.position === "seated" ? Armchair : PersonStanding;
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
                              <span>
                                <Clock3 size={14} aria-hidden="true" />{" "}
                                {t("training.minutes", { count: exercise.minutes })}
                              </span>
                              <span>
                                <PostureIcon size={14} aria-hidden="true" />{" "}
                                {t(exercise.position === "seated" ? "training.seated" : "training.standing")}
                              </span>
                              <span>
                                <ListChecks size={14} aria-hidden="true" />{" "}
                                {t("training.stepsCount", { count: content.steps.length })}
                              </span>
                            </div>
                            <span className="training-row-equipment">
                              {t("training.equipment")}: {content.equipment}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="training-row-action"
                            aria-haspopup="dialog"
                            aria-label={`${t("training.show")}: ${content.title}`}
                            onClick={() => openSingleMovement(exercise)}
                          >
                            <span>{t("training.show")}</span>
                            <ArrowUpRight size={15} aria-hidden="true" />
                          </button>
                        </article>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </section>
        )}
        {modalExercise && (
          <ExerciseAnimation
            exercise={modalExercise}
            routine={
              activeRoutine
                ? {
                    title: t(`training.routines.${activeRoutine.key}.title`),
                    items: activeRoutine.items,
                    index: activeRoutine.index,
                    onSelectIndex: (index) =>
                      setActiveRoutine((current) => (current ? { ...current, index } : null)),
                  }
                : null
            }
            onClose={closeMovementModal}
          />
        )}
      </div>
    </AppShell>
  );
}
