"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ClubActivity } from "@/lib/activities";
import { ActivityCalendarSection } from "@/components/club/activity-calendar";
import {
  AnnouncementFeedSection,
  PollActivitiesSection,
} from "@/components/club/activity-feed-sections";
import { HomeNewsSection } from "@/components/club/home-news";
import { LatestCommunityPosts } from "@/components/community/latest-community-posts";
import { useAuth } from "@/components/auth/auth-provider";
import { ClubFooter, ClubHeader } from "@/components/layout/site-chrome";
import { useI18n } from "@/i18n/i18n-provider";
import { apiJson, errorMessage } from "@/lib/api/client";
import {
  categoryColor,
  categoryLabel,
  dateKey,
  repeatIntervalKeys,
} from "@/lib/club-ui";
import {
  getInitialAnnouncements,
  type ClubAnnouncement,
  type ClubPost,
} from "@/lib/content";

// Modals are rarely opened, so keep them out of the initial bundle.
const CreateActivityModal = dynamic(() =>
  import("@/components/club/activity-modals").then((m) => m.CreateActivityModal),
);
const QuickSignupModal = dynamic(() =>
  import("@/components/club/activity-modals").then((m) => m.QuickSignupModal),
);
const EditAnnouncementModal = dynamic(() =>
  import("@/components/club/activity-modals").then((m) => m.EditAnnouncementModal),
);

type View = "overview" | "activities" | "announcement-create";
type ContentData = {
  announcements: ClubAnnouncement[];
  posts: ClubPost[];
};

const ALL_CATEGORIES = "ALL";
const filterCategories = [ALL_CATEGORIES, "CẦU LÔNG", "TỪ THIỆN", "THỂ THAO", "CÂU LẠC BỘ"];

export default function ClubApp({ initialView }: { initialView: View }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, intlLocale } = useI18n();
  const { user, loading: authLoading } = useAuth();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const loginHref = `/login?next=${encodeURIComponent(pathname)}`;
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [content, setContent] = useState<ContentData | null>(null);
  const [contentError, setContentError] = useState("");
  const [activityCategory, setActivityCategory] = useState(ALL_CATEGORIES);
  const [activities, setActivities] = useState<ClubActivity[]>([]);
  const [activitiesError, setActivitiesError] = useState("");
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isQuickSignupModalOpen, setIsQuickSignupModalOpen] = useState(false);
  const [activityFormError, setActivityFormError] = useState("");
  const [activityFormLoading, setActivityFormLoading] = useState(false);
  const [quickSignupError, setQuickSignupError] = useState("");
  const [quickSignupLoading, setQuickSignupLoading] = useState(false);
  const [activityScheduleType, setActivityScheduleType] =
    useState<"scheduled" | "poll">("scheduled");
  const [announcementFormError, setAnnouncementFormError] = useState("");
  const [announcementFormLoading, setAnnouncementFormLoading] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<ClubAnnouncement | null>(null);
  const [announcementActionError, setAnnouncementActionError] = useState("");
  const [announcementActionLoading, setAnnouncementActionLoading] =
    useState(false);
  const welcomeAnnouncement = useMemo(
    () => getInitialAnnouncements(t).find((announcement) => announcement.id === "welcome"),
    [t],
  );

  const period = useMemo(() => {
    const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [anchorDate]);

  const loadContent = useCallback(async () => {
    try {
      const data = await apiJson<ContentData>("/api/content");
      setContent(data);
      setContentError("");
    } catch (error) {
      setContentError(errorMessage(error, tRef.current("club.errors.loadContent")));
    }
  }, []);

  const loadActivities = useCallback(async () => {
    setActivitiesLoading(true);
    try {
      const data = await apiJson<{ activities?: ClubActivity[] }>("/api/activities");
      setActivities(data.activities ?? []);
      setActivitiesError("");
    } catch (error) {
      setActivitiesError(errorMessage(error, tRef.current("club.errors.loadActivities")));
    } finally {
      setActivitiesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialView === "overview" || initialView === "activities") {
      void loadContent();
    }
  }, [initialView, loadContent]);

  useEffect(() => {
    if (initialView === "overview" || initialView === "activities") {
      void loadActivities();
    }
  }, [initialView, loadActivities]);

  useEffect(() => {
    if (initialView !== "activities") return;
    const requestedDate = new URLSearchParams(window.location.search).get("date");
    if (!requestedDate || !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) return;

    const nextDate = new Date(`${requestedDate}T00:00:00`);
    if (dateKey(nextDate) !== requestedDate) return;

    setSelectedDate(requestedDate);
    setAnchorDate(nextDate);
  }, [initialView]);

  const activitiesForSelectedDate = useMemo(
    () =>
      activities.filter(
        (activity) =>
          activity.scheduleType !== "poll" &&
          activity.date !== null &&
          (activity.day ?? dateKey(new Date(activity.date))) === selectedDate,
      ),
    [activities, selectedDate],
  );
  const latestAnnouncements = useMemo(
    () =>
      [...(content?.announcements ?? [])]
        .sort((first, second) => second.date.localeCompare(first.date))
        .slice(0, 5),
    [content],
  );
  const latestHomeActivities = useMemo(() => {
    const grouped = new Map<string, ClubActivity>();
    for (const activity of activities) {
      const seriesKey = activity.recurrenceSeriesId ?? activity.id;
      const existing = grouped.get(seriesKey);
      const activityDate = activity.day ?? activity.date?.slice(0, 10) ?? "";
      const existingDate = existing?.day ?? existing?.date?.slice(0, 10) ?? "";
      if (!existing || activityDate < existingDate) {
        grouped.set(seriesKey, activity);
      }
    }
    return [...grouped.values()]
      .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
      .slice(0, 3);
  }, [activities]);
  const activitiesForVoting = useMemo(
    () =>
      activities.filter(
        (activity) =>
          activity.scheduleType === "poll" &&
          (activityCategory === ALL_CATEGORIES ||
            activity.category === activityCategory),
      ),
    [activities, activityCategory],
  );
  const allAnnouncements = useMemo(() => content?.announcements ?? [], [content]);
  const announcementLoginHref = `/login?next=${encodeURIComponent("/activities/announcements/new")}`;
  const movePeriod = useCallback((direction: number) => {
    setAnchorDate((current) => {
      const next = new Date(current);
      next.setMonth(next.getMonth() + direction, 1);
      return next;
    });
  }, []);
  const openActivity = useCallback(
    (activity: ClubActivity) =>
      router.push(`/activities/${encodeURIComponent(activity.id)}`),
    [router],
  );
  const retryContent = useCallback(() => void loadContent(), [loadContent]);
  const retryActivities = useCallback(() => void loadActivities(), [loadActivities]);
  const selectDate = useCallback((date: string, outsideMonth: boolean, day: Date) => {
    setSelectedDate(date);
    if (outsideMonth) setAnchorDate(day);
  }, []);
  const handleActivityJoined = useCallback((activityId: string, name: string) => {
    const normalize = (value: string) => value.normalize("NFC").toLocaleLowerCase("vi");
    setActivities((current) =>
      current.map((activity) =>
        activity.id === activityId &&
        !activity.participants.some(
          (participant) => normalize(participant) === normalize(name),
        )
          ? { ...activity, participants: [...activity.participants, name] }
          : activity,
      ),
    );
  }, []);
  const handleEditAnnouncement = useCallback((announcement: ClubAnnouncement) => {
    setAnnouncementActionError("");
    setEditingAnnouncement(announcement);
  }, []);

  const openCreateActivity = useCallback(() => {
    if (authLoading) return;
    if (!user) {
      router.push(loginHref);
      return;
    }
    setActivityFormError("");
    setActivityScheduleType("scheduled");
    setIsCreateModalOpen(true);
  }, [authLoading, user, loginHref, router]);

  const openQuickSignup = useCallback(() => {
    if (authLoading) return;
    if (!user) {
      router.push(loginHref);
      return;
    }
    setQuickSignupError("");
    setIsQuickSignupModalOpen(true);
  }, [authLoading, user, loginHref, router]);

  async function createActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActivityFormError("");
    setActivityFormLoading(true);
    const formData = new FormData(event.currentTarget);
    const scheduleType = String(formData.get("scheduleType"));
    const localDate = String(formData.get("date") ?? "");
    const repeatEnabled = formData.get("repeatEnabled") === "on";

    try {
      const data = await apiJson<{ activity?: ClubActivity }>("/api/activities", {
        method: "POST",
        json: {
          title: formData.get("title"),
          description: formData.get("description"),
          category: formData.get("category"),
          scheduleType,
          day:
            scheduleType === "scheduled" && localDate
              ? localDate.slice(0, 10)
              : null,
          date:
            scheduleType === "scheduled" && localDate
              ? new Date(localDate).toISOString()
              : null,
          creator: formData.get("creator"),
          ...(repeatEnabled && scheduleType === "scheduled"
            ? {
                repeat: {
                  interval: formData.get("repeatInterval"),
                  endType: formData.get("repeatEndType"),
                  ...(formData.get("repeatEndType") === "count"
                    ? { count: Number(formData.get("repeatCount")) }
                    : {}),
                  ...(formData.get("repeatEndType") === "until"
                    ? { until: formData.get("repeatUntil") }
                    : {}),
                },
              }
            : {}),
        },
      });
      if (!data.activity) {
        throw new Error(t("club.errors.createActivityNoData"));
      }
      const createdActivity = data.activity;
      setIsCreateModalOpen(false);
      setActivityScheduleType("scheduled");
      await loadActivities();
      router.push(`/activities/${encodeURIComponent(createdActivity.id)}`);
    } catch (error) {
      setActivityFormError(errorMessage(error, t("club.errors.createActivity")));
    } finally {
      setActivityFormLoading(false);
    }
  }

  async function createQuickSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuickSignupError("");
    setQuickSignupLoading(true);
    const formData = new FormData(event.currentTarget);

    try {
      const data = await apiJson<{ activity?: ClubActivity }>("/api/activities", {
        method: "POST",
        json: {
          kind: "quick-signup",
          title: formData.get("title"),
          day: selectedDate,
        },
      });
      if (!data.activity) {
        throw new Error(t("club.errors.createQuickSignupNoData"));
      }
      const createdActivity = data.activity;
      setActivities((current) =>
        [...current, createdActivity].sort((first, second) =>
          second.createdAt.localeCompare(first.createdAt),
        ),
      );
      setIsQuickSignupModalOpen(false);
      router.push(`/activities/${encodeURIComponent(createdActivity.id)}`);
    } catch (error) {
      setQuickSignupError(errorMessage(error, t("club.errors.createQuickSignup")));
    } finally {
      setQuickSignupLoading(false);
    }
  }

  async function createAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAnnouncementFormError("");
    setAnnouncementFormLoading(true);
    const formData = new FormData(event.currentTarget);

    try {
      const data = await apiJson<{ announcement?: ClubAnnouncement }>("/api/announcements", {
        method: "POST",
        json: {
          title: formData.get("title"),
          description: formData.get("description"),
          category: formData.get("category"),
        },
      });
      if (!data.announcement) {
        throw new Error(t("club.errors.createAnnouncementNoData"));
      }
      const createdAnnouncement = data.announcement;

      setContent((current) =>
        current
          ? {
              ...current,
              announcements: [
                ...current.announcements.filter(
                  (announcement) => announcement.id === "welcome",
                ),
                createdAnnouncement,
                ...current.announcements.filter(
                  (announcement) => announcement.id !== "welcome",
                ),
              ],
            }
          : current,
      );
      router.push("/activities");
    } catch (error) {
      setAnnouncementFormError(errorMessage(error, t("club.errors.createAnnouncement")));
    } finally {
      setAnnouncementFormLoading(false);
    }
  }

  async function editAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingAnnouncement) return;

    setAnnouncementActionError("");
    setAnnouncementActionLoading(true);
    const formData = new FormData(event.currentTarget);
    try {
      const data = await apiJson<{ announcement?: ClubAnnouncement }>(
        `/api/announcements/${editingAnnouncement.id}`,
        {
          method: "PATCH",
          json: {
            title: formData.get("title"),
            description: formData.get("description"),
            category: formData.get("category"),
          },
        },
      );
      if (!data.announcement) {
        throw new Error(t("club.errors.editAnnouncementNoData"));
      }

      setContent((current) =>
        current
          ? {
              ...current,
              announcements: current.announcements.map((announcement) =>
                announcement.id === data.announcement?.id
                  ? data.announcement
                  : announcement,
              ),
            }
          : current,
      );
      setEditingAnnouncement(null);
    } catch (error) {
      setAnnouncementActionError(errorMessage(error, t("club.errors.editAnnouncement")));
    } finally {
      setAnnouncementActionLoading(false);
    }
  }

  const deleteAnnouncement = useCallback(async (announcement: ClubAnnouncement) => {
    if (
      !window.confirm(t("club.announcements.confirmDelete", { title: announcement.title }))
    ) {
      return;
    }

    setAnnouncementActionError("");
    setAnnouncementActionLoading(true);
    try {
      await apiJson<{ ok?: boolean }>(`/api/announcements/${announcement.id}`, {
        method: "DELETE",
      });
      setContent((current) =>
        current
          ? {
              ...current,
              announcements: current.announcements.filter(
                (item) => item.id !== announcement.id,
              ),
            }
          : current,
      );
    } catch (error) {
      setAnnouncementActionError(errorMessage(error, t("club.errors.deleteAnnouncement")));
    } finally {
      setAnnouncementActionLoading(false);
    }
  }, [t]);
  const handleDeleteAnnouncement = useCallback(
    (announcement: ClubAnnouncement) => void deleteAnnouncement(announcement),
    [deleteAnnouncement],
  );

  return (
    <main className="app-main">
      <div className="page-shell app-shell">
        <ClubHeader
          currentPage={initialView === "overview" ? "overview" : "activities"}
        />

        {initialView === "overview" ? (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow"><span className="eyebrow-dot" /> {t("club.home.eyebrow")}</div>
                <h1>{t("club.home.titleLine1")}<br />{t("club.home.titleLine2")}<span className="hero-period">.</span></h1>
                <p>{t("club.home.description")}</p>
                <div className="hero-actions">
                  <button
                    className="button-primary"
                    type="button"
                    onClick={openCreateActivity}
                  >
                    {t("club.home.createActivity")} <span aria-hidden="true">+</span>
                  </button>
                </div>
              </div>
              <div className="hero-art" aria-label={t("club.home.heroArtLabel")}>
                <div className="art-sun" />
                <div className="art-ring ring-one" />
                <div className="art-ring ring-two" />
                <div className="art-shape shape-orange" />
                <div className="art-shape shape-lime" />
                <div className="art-shape shape-lilac" />
                <div className="art-racket"><span /></div>
                <div className="art-ball">✦</div>
                <div className="art-caption"><span>01 / 03</span><strong>Move with<br />good energy.</strong></div>
                <div className="hero-sticker"><span>✳</span><small>MOVE<br />TOGETHER</small></div>
              </div>
            </section>

            <section className="activity-strip" id="activities">
              <div className="section-intro">
                <span className="section-kicker">{t("club.home.stripKicker")}</span>
                <h2>{t("club.home.stripTitleLine1")}<br />{t("club.home.stripTitleLine2")}</h2>
                <p>{t("club.home.stripSubtitle")}</p>
                <Link className="text-link" href="/activities">
                  {t("club.home.viewAll")} <span aria-hidden="true">↗</span>
                </Link>
              </div>
              {activitiesLoading ? (
                <p className="card-description">{t("club.home.loadingActivities")}</p>
              ) : activitiesError ? (
                <p className="card-description" role="alert">{activitiesError}</p>
              ) : latestHomeActivities.length ? (
                <div className="activity-cards">
                  {latestHomeActivities.map((activity, index) => {
                    return (
                      <Link
                        className={`activity-card ${["badminton-card", "charity-card", "sport-card"][index % 3]}`}
                        href={`/activities/${encodeURIComponent(activity.id)}`}
                        key={activity.id}
                      >
                        <span className="card-number">
                          {String(index + 1).padStart(2, "0")} —{" "}
                          {activity.kind === "quick-signup"
                            ? t("club.categories.quickSignup")
                            : categoryLabel(t, activity.category)}
                        </span>
                        <strong>{activity.title}</strong>
                        <span className="card-description">
                          {t("club.home.participants", { count: activity.participants.length })}
                        </span>
                        {activity.repeat && (
                          <span className="card-repeat-label">
                            {t("club.repeat.label", {
                              interval: t(repeatIntervalKeys[activity.repeat.interval]),
                            })}
                          </span>
                        )}
                        <span className="card-arrow">↗</span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="card-description">
                  {t("club.home.noActivities")}{" "}
                  <Link href="/activities">{t("club.home.openActivities")} ↗</Link>
                </p>
              )}
            </section>

            <HomeNewsSection
              announcements={latestAnnouncements}
              contentLoaded={content !== null}
              contentError={contentError}
              onRetryContent={retryContent}
            />
            <LatestCommunityPosts />
          </>
        ) : initialView === "activities" ? (
          <section className="activities-page">
            <div className="activities-page-heading">
              <div>
                <div className="eyebrow"><span className="eyebrow-dot" /> {t("club.activities.eyebrow")}</div>
                <h1>{t("club.activities.title")}<span className="hero-period">.</span></h1>
                <p>{t("club.activities.subtitle")}</p>
              </div>
              <div className="activities-heading-mark" aria-hidden="true">✳</div>
            </div>
            <div className="activity-filters" aria-label={t("club.activities.filterAria")}>
              {filterCategories.map((category) => (
                <button
                  className={activityCategory === category ? "activity-filter active" : "activity-filter"}
                  key={category}
                  onClick={() => setActivityCategory(category)}
                  aria-pressed={activityCategory === category}
                >
                  {category === ALL_CATEGORIES ? t("club.categories.all") : categoryLabel(t, category)}
                </button>
              ))}
            </div>
            <ActivityCalendarSection
              anchorDate={anchorDate}
              period={period}
              selectedDate={selectedDate}
              activities={activities}
              activitiesForSelectedDate={activitiesForSelectedDate}
              activitiesError={activitiesError}
              activitiesLoading={activitiesLoading}
              canInteract={Boolean(user)}
              loginHref={loginHref}
              onMoveMonth={movePeriod}
              onSelectDate={selectDate}
              onRetryActivities={retryActivities}
              onCreateActivity={openCreateActivity}
              onCreateQuickSignup={openQuickSignup}
              onOpenActivity={openActivity}
              onActivityJoined={handleActivityJoined}
            />
            <PollActivitiesSection
              activities={activitiesForVoting}
              loading={activitiesLoading}
              onSelect={openActivity}
            />
            <AnnouncementFeedSection
              welcomeAnnouncement={welcomeAnnouncement}
              announcements={allAnnouncements}
              contentError={contentError}
              actionError={announcementActionError}
              actionLoading={announcementActionLoading}
              canManage={user !== null}
              createHref={user || authLoading ? "/activities/announcements/new" : announcementLoginHref}
              onRetry={retryContent}
              onEdit={handleEditAnnouncement}
              onDelete={handleDeleteAnnouncement}
            />
          </section>
        ) : initialView === "announcement-create" ? (
          <section className="announcement-create-page">
            <Link className="text-link announcement-back-link" href="/activities">{t("club.announcements.back")}</Link>
            <div className="announcement-create-panel">
              <div className="eyebrow"><span className="eyebrow-dot" /> {t("club.announcements.createPage.eyebrow")}</div>
              <h1>{t("club.announcements.createPage.title")}<span className="hero-period">.</span></h1>
              <p>{t("club.announcements.createPage.subtitle")}</p>
              {!authLoading && !user ? (
                <p className="modal-error" role="alert">
                  {t("club.auth.loginToCreateAnnouncement")}{" "}
                  <Link className="text-link" href={loginHref}>{t("club.auth.login")}</Link>
                </p>
              ) : (
              <form className="activity-form" onSubmit={createAnnouncement}>
                <label htmlFor="announcement-category">{t("club.announcements.form.categoryLabel")}</label>
                <select id="announcement-category" name="category" defaultValue="CÂU LẠC BỘ">
                  <option value="CÂU LẠC BỘ">{t("club.categoryOptions.club")}</option>
                  <option value="CẦU LÔNG">{t("club.categoryOptions.badminton")}</option>
                  <option value="TỪ THIỆN">{t("club.categoryOptions.charity")}</option>
                  <option value="THỂ THAO">{t("club.categoryOptions.sport")}</option>
                </select>
                <label htmlFor="announcement-title">{t("club.announcements.form.titleLabel")}</label>
                <input id="announcement-title" name="title" placeholder={t("club.announcements.createPage.titlePlaceholder")} minLength={3} maxLength={120} required />
                <label htmlFor="announcement-description">{t("club.announcements.form.descriptionLabel")}</label>
                <textarea id="announcement-description" name="description" placeholder={t("club.announcements.createPage.descriptionPlaceholder")} minLength={5} maxLength={1000} rows={6} required />
                {announcementFormError && <p className="modal-error" role="alert">{announcementFormError}</p>}
                <div className="announcement-form-actions">
                  <Link className="button-secondary" href="/activities">{t("club.announcements.form.cancel")}</Link>
                  <button className="button-primary" type="submit" disabled={announcementFormLoading}>
                    {announcementFormLoading ? t("club.announcements.createPage.submitting") : t("club.announcements.createPage.submit")}
                  </button>
                </div>
              </form>
              )}
            </div>
          </section>
        ) : null}

        {isCreateModalOpen && (
          <CreateActivityModal
            scheduleType={activityScheduleType}
            defaultDateTime={`${selectedDate}T18:00`}
            defaultCreator={user?.displayName ?? ""}
            error={activityFormError}
            loading={activityFormLoading}
            onScheduleTypeChange={setActivityScheduleType}
            onSubmit={createActivity}
            onClose={() => setIsCreateModalOpen(false)}
          />
        )}

        {isQuickSignupModalOpen && (
          <QuickSignupModal
            defaultTitle=""
            error={quickSignupError}
            loading={quickSignupLoading}
            onSubmit={createQuickSignup}
            onClose={() => setIsQuickSignupModalOpen(false)}
          />
        )}

        {editingAnnouncement && (
          <EditAnnouncementModal
            announcement={editingAnnouncement}
            error={announcementActionError}
            loading={announcementActionLoading}
            onSubmit={editAnnouncement}
            onClose={() => setEditingAnnouncement(null)}
          />
        )}

        <ClubFooter />
      </div>
    </main>
  );
}
