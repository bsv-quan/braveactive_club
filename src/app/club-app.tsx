"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ActivityComment, ClubActivity } from "@/lib/activities";
import { ActivityCalendarSection } from "@/components/club/activity-calendar";
import {
  ActivityDetailsModal,
  CreateActivityModal,
  EditAnnouncementModal,
  QuickSignupModal,
} from "@/components/club/activity-modals";
import {
  AnnouncementFeedSection,
  PollActivitiesSection,
} from "@/components/club/activity-feed-sections";
import { HomeNewsSection } from "@/components/club/home-news";
import { ClubFooter, ClubHeader } from "@/components/club/site-chrome";
import {
  dateKey,
} from "@/lib/club-ui";
import {
  initialAnnouncements,
  type ClubAnnouncement,
  type ClubPost,
} from "@/lib/content";

type View = "overview" | "activities" | "announcement-create";
type ContentData = {
  announcements: ClubAnnouncement[];
  posts: ClubPost[];
};

function activityCalendarDate(activity: ClubActivity) {
  if (activity.day) return activity.day;
  if (activity.date) return dateKey(new Date(activity.date));
  return Object.values(activity.votes ?? {}).flat().sort()[0] ?? null;
}

export default function ClubApp({ initialView }: { initialView: View }) {
  const router = useRouter();
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [content, setContent] = useState<ContentData | null>(null);
  const [contentError, setContentError] = useState("");
  const [activityCategory, setActivityCategory] = useState("Tất cả");
  const [activities, setActivities] = useState<ClubActivity[]>([]);
  const [activitiesError, setActivitiesError] = useState("");
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isQuickSignupModalOpen, setIsQuickSignupModalOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [activityFormError, setActivityFormError] = useState("");
  const [activityFormLoading, setActivityFormLoading] = useState(false);
  const [quickSignupError, setQuickSignupError] = useState("");
  const [quickSignupLoading, setQuickSignupLoading] = useState(false);
  const [activityScheduleType, setActivityScheduleType] =
    useState<"scheduled" | "poll">("scheduled");
  const [participantName, setParticipantName] = useState("");
  const [pollName, setPollName] = useState("");
  const [selectedPollDates, setSelectedPollDates] = useState<string[]>([]);
  const [activityActionError, setActivityActionError] = useState("");
  const [activityActionNotice, setActivityActionNotice] = useState("");
  const [activityActionLoading, setActivityActionLoading] = useState(false);
  const [commentMessage, setCommentMessage] = useState("");
  const [commentError, setCommentError] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [deletingParticipantName, setDeletingParticipantName] = useState("");
  const [announcementFormError, setAnnouncementFormError] = useState("");
  const [announcementFormLoading, setAnnouncementFormLoading] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] =
    useState<ClubAnnouncement | null>(null);
  const [announcementActionError, setAnnouncementActionError] = useState("");
  const [announcementActionLoading, setAnnouncementActionLoading] =
    useState(false);
  const welcomeAnnouncement = initialAnnouncements.find(
    (announcement) => announcement.id === "welcome",
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
      const response = await fetch("/api/content");
      const data = (await response.json()) as ContentData & { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Không thể tải bảng tin.");
      setContent(data);
      setContentError("");
    } catch (error) {
      setContentError(
        error instanceof Error ? error.message : "Không thể tải bảng tin.",
      );
    }
  }, []);

  const loadActivities = useCallback(async () => {
    setActivitiesLoading(true);
    try {
      const response = await fetch("/api/activities");
      const data = (await response.json()) as {
        activities?: ClubActivity[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Không thể tải hoạt động.");
      setActivities(data.activities ?? []);
      setActivitiesError("");
    } catch (error) {
      setActivitiesError(
        error instanceof Error ? error.message : "Không thể tải hoạt động.",
      );
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

  const activitiesForSelectedDate = activities.filter(
    (activity) =>
      activity.scheduleType !== "poll" &&
      activity.date !== null &&
      (activity.day ?? dateKey(new Date(activity.date))) === selectedDate,
  );
  const latestAnnouncements = [...(content?.announcements ?? [])]
    .sort((first, second) => second.date.localeCompare(first.date))
    .slice(0, 5);
  const latestHomeActivities = [...activities]
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
    .slice(0, 3);
  const selectedActivity = activities.find(
    (activity) => activity.id === selectedActivityId,
  );
  const activitiesForVoting = activities.filter(
    (activity) =>
      activity.scheduleType === "poll" &&
      (activityCategory === "Tất cả" ||
        activity.category === activityCategory),
  );
  function movePeriod(direction: number) {
    const next = new Date(anchorDate);
    next.setMonth(next.getMonth() + direction, 1);
    setAnchorDate(next);
  }

  function openCreateActivity() {
    setActivityFormError("");
    setActivityScheduleType("scheduled");
    setIsCreateModalOpen(true);
  }

  function openQuickSignup() {
    setQuickSignupError("");
    setIsQuickSignupModalOpen(true);
  }

  async function createActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActivityFormError("");
    setActivityFormLoading(true);
    const formData = new FormData(event.currentTarget);
    const scheduleType = String(formData.get("scheduleType"));
    const localDate = String(formData.get("date") ?? "");

    try {
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
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
        }),
      });
      const data = (await response.json()) as {
        activity?: ClubActivity;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Không thể tạo hoạt động.");
      if (!data.activity) {
        throw new Error("Máy chủ không trả về thông tin hoạt động mới.");
      }
      const createdActivity = data.activity;
      setActivities((current) =>
        [...current, { ...createdActivity, participants: [], votes: {}, comments: [] }].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      );
      setIsCreateModalOpen(false);
      setActivityScheduleType("scheduled");
      setSelectedActivityId(createdActivity.id);
      if (initialView !== "activities") router.push("/activities");
    } catch (error) {
      setActivityFormError(
        error instanceof Error ? error.message : "Không thể tạo hoạt động.",
      );
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
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "quick-signup",
          title: formData.get("title"),
          day: selectedDate,
        }),
      });
      const data = (await response.json()) as {
        activity?: ClubActivity;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Không thể tạo đăng ký nhanh.");
      }
      if (!data.activity) {
        throw new Error("Máy chủ không trả về thông tin đăng ký vừa tạo.");
      }
      const createdActivity = data.activity;
      setActivities((current) =>
        [...current, createdActivity].sort((first, second) =>
          second.createdAt.localeCompare(first.createdAt),
        ),
      );
      setIsQuickSignupModalOpen(false);
      setActivityActionError("");
      setActivityActionNotice("");
      setSelectedActivityId(createdActivity.id);
    } catch (error) {
      setQuickSignupError(
        error instanceof Error ? error.message : "Không thể tạo đăng ký nhanh.",
      );
    } finally {
      setQuickSignupLoading(false);
    }
  }

  async function voteForActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedActivity || selectedPollDates.length === 0) return;

    setActivityActionError("");
    setActivityActionNotice("");
    setActivityActionLoading(true);
    try {
      const response = await fetch(
        `/api/activities/${selectedActivity.id}/votes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: pollName,
            dates: selectedPollDates,
          }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Không thể gửi bình chọn.");
      setPollName("");
      setActivityActionNotice(
        "Đã ghi nhận bình chọn. Bạn có thể gửi lại để thay đổi các ngày phù hợp.",
      );
      await loadActivities();
    } catch (error) {
      setActivityActionError(
        error instanceof Error ? error.message : "Không thể gửi bình chọn.",
      );
    } finally {
      setActivityActionLoading(false);
    }
  }

  async function addActivityComment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedActivity) return;

    setCommentError("");
    setCommentLoading(true);
    try {
      const response = await fetch(
        `/api/activities/${selectedActivity.id}/comments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: commentMessage }),
        },
      );
      const data = (await response.json()) as {
        comment?: ActivityComment;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Không thể gửi bình luận.");
      }
      if (!data.comment) {
        throw new Error("Máy chủ không trả về bình luận vừa gửi.");
      }
      const createdComment = data.comment;
      setActivities((current) =>
        current.map((activity) =>
          activity.id === selectedActivity.id
            ? {
                ...activity,
                comments: [...(activity.comments ?? []), createdComment],
              }
            : activity,
        ),
      );
      setCommentMessage("");
    } catch (error) {
      setCommentError(
        error instanceof Error ? error.message : "Không thể gửi bình luận.",
      );
    } finally {
      setCommentLoading(false);
    }
  }

  async function createAnnouncement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAnnouncementFormError("");
    setAnnouncementFormLoading(true);
    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title"),
          description: formData.get("description"),
          category: formData.get("category"),
        }),
      });
      const data = (await response.json()) as {
        announcement?: ClubAnnouncement;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Không thể tạo thông báo.");
      }
      if (!data.announcement) {
        throw new Error("Máy chủ không trả về thông tin thông báo mới.");
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
      setAnnouncementFormError(
        error instanceof Error ? error.message : "Không thể tạo thông báo.",
      );
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
      const response = await fetch(
        `/api/announcements/${editingAnnouncement.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: formData.get("title"),
            description: formData.get("description"),
            category: formData.get("category"),
          }),
        },
      );
      const data = (await response.json()) as {
        announcement?: ClubAnnouncement;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(data.error ?? "Không thể sửa thông báo.");
      }
      if (!data.announcement) {
        throw new Error("Máy chủ không trả về thông tin thông báo đã sửa.");
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
      setAnnouncementActionError(
        error instanceof Error ? error.message : "Không thể sửa thông báo.",
      );
    } finally {
      setAnnouncementActionLoading(false);
    }
  }

  async function deleteAnnouncement(announcement: ClubAnnouncement) {
    if (
      !window.confirm(`Xóa thông báo "${announcement.title}"?`)
    ) {
      return;
    }

    setAnnouncementActionError("");
    setAnnouncementActionLoading(true);
    try {
      const response = await fetch(`/api/announcements/${announcement.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Không thể xóa thông báo.");
      }
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
      setAnnouncementActionError(
        error instanceof Error ? error.message : "Không thể xóa thông báo.",
      );
    } finally {
      setAnnouncementActionLoading(false);
    }
  }

  async function joinActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedActivity) return;
    setActivityActionError("");
    setActivityActionNotice("");
    setActivityActionLoading(true);
    try {
      const response = await fetch(
        `/api/activities/${selectedActivity.id}/join`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: participantName }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Không thể tham gia.");
      setParticipantName("");
      setActivityActionNotice("Bạn đã đăng ký tham gia hoạt động.");
      await loadActivities();
    } catch (error) {
      setActivityActionError(
        error instanceof Error ? error.message : "Không thể tham gia.",
      );
    } finally {
      setActivityActionLoading(false);
    }
  }

  async function deleteActivityParticipant(member: string) {
    if (!selectedActivity) return;
    if (!window.confirm(`Xóa "${member}" khỏi hoạt động "${selectedActivity.title}"?`)) {
      return;
    }

    setDeletingParticipantName(member);
    setActivityActionError("");
    setActivityActionNotice("");
    try {
      const response = await fetch(
        `/api/activities/${selectedActivity.id}/join`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: member }),
        },
      );
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Không thể xóa người tham gia.");
      setActivityActionNotice(`Đã xóa ${member} khỏi hoạt động.`);
      await loadActivities();
    } catch (error) {
      setActivityActionError(
        error instanceof Error
          ? error.message
          : "Không thể xóa người tham gia.",
      );
    } finally {
      setDeletingParticipantName("");
    }
  }

  async function deleteActivity() {
    if (!selectedActivity) return;
    if (!window.confirm(`Xóa hoạt động "${selectedActivity.title}"?`)) return;
    setActivityActionError("");
    setActivityActionNotice("");
    setActivityActionLoading(true);
    try {
      const response = await fetch(`/api/activities/${selectedActivity.id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Không thể xóa hoạt động.");
      setActivities((current) =>
        current.filter((activity) => activity.id !== selectedActivity.id),
      );
      setSelectedActivityId(null);
    } catch (error) {
      setActivityActionError(
        error instanceof Error ? error.message : "Không thể xóa hoạt động.",
      );
    } finally {
      setActivityActionLoading(false);
    }
  }

  return (
    <main>
      <div className="page-shell">
        <ClubHeader
          currentPage={initialView === "overview" ? "overview" : "activities"}
        />

        {initialView === "overview" ? (
          <>
            <section className="hero">
              <div className="hero-copy">
                <div className="eyebrow"><span className="eyebrow-dot" /> CỘNG ĐỒNG NĂNG ĐỘNG</div>
                <h1>Cùng nhau<br />năng động hơn<span className="hero-period">.</span></h1>
                <p>
                  Kết nối, vận động và sẻ chia. Mỗi hoạt động là một cơ hội để
                  chúng ta cùng tạo nên điều tuyệt vời.
                </p>
                <div className="hero-actions">
                  <button
                    className="button-primary"
                    type="button"
                    onClick={openCreateActivity}
                  >
                    Tạo hoạt động <span aria-hidden="true">+</span>
                  </button>
                </div>
              </div>
              <div className="hero-art" aria-label="Minh họa câu lạc bộ thể thao">
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
                <span className="section-kicker">CÓ GÌ ĐANG DIỄN RA</span>
                <h2>Hoạt động<br />của chúng mình</h2>
                <p>Chọn cách bạn muốn kết nối với cộng đồng.</p>
                <Link className="text-link" href="/activities">
                  Xem tất cả <span aria-hidden="true">↗</span>
                </Link>
              </div>
              {activitiesLoading ? (
                <p className="card-description">Đang tải hoạt động...</p>
              ) : activitiesError ? (
                <p className="card-description" role="alert">{activitiesError}</p>
              ) : latestHomeActivities.length ? (
                <div className="activity-cards">
                  {latestHomeActivities.map((activity, index) => {
                    const activityDate = activityCalendarDate(activity);
                    return (
                      <Link
                        className={`activity-card ${["badminton-card", "charity-card", "sport-card"][index % 3]}`}
                        href={
                          activityDate
                            ? `/activities?date=${encodeURIComponent(activityDate)}`
                            : "/activities"
                        }
                        key={activity.id}
                      >
                        <span className="card-number">
                          {String(index + 1).padStart(2, "0")} —{" "}
                          {activity.kind === "quick-signup"
                            ? "ĐĂNG KÝ NHANH"
                            : activity.category}
                        </span>
                        <strong>{activity.title}</strong>
                        <span className="card-description">
                          {activity.participants.length} người đăng ký
                        </span>
                        <span className="card-arrow">↗</span>
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <p className="card-description">
                  Chưa có hoạt động nào.{" "}
                  <Link href="/activities">Mở màn hình hoạt động ↗</Link>
                </p>
              )}
            </section>

            <HomeNewsSection
              announcements={latestAnnouncements}
              contentLoaded={content !== null}
              contentError={contentError}
              onRetryContent={() => void loadContent()}
            />
          </>
        ) : initialView === "activities" ? (
          <section className="activities-page">
            <div className="activities-page-heading">
              <div>
                <div className="eyebrow"><span className="eyebrow-dot" /> CẬP NHẬT TỪ CỘNG ĐỒNG</div>
                <h1>Bảng tin hoạt động<span className="hero-period">.</span></h1>
                <p>Những câu chuyện, thông báo và hoạt động mới nhất từ Brave Active.</p>
              </div>
              <div className="activities-heading-mark" aria-hidden="true">✳</div>
            </div>
            <div className="activity-filters" aria-label="Lọc bản tin theo hoạt động">
              {["Tất cả", "CẦU LÔNG", "TỪ THIỆN", "THỂ THAO", "CÂU LẠC BỘ"].map((category) => (
                <button
                  className={activityCategory === category ? "activity-filter active" : "activity-filter"}
                  key={category}
                  onClick={() => setActivityCategory(category)}
                  aria-pressed={activityCategory === category}
                >
                  {category}
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
              onMoveMonth={movePeriod}
              onSelectDate={(date, outsideMonth, day) => {
                setSelectedDate(date);
                if (outsideMonth) setAnchorDate(day);
              }}
              onRetryActivities={() => void loadActivities()}
              onCreateActivity={openCreateActivity}
              onCreateQuickSignup={openQuickSignup}
              onOpenActivity={(activity) => {
                setActivityActionError("");
                setActivityActionNotice("");
                setSelectedPollDates([]);
                setSelectedActivityId(activity.id);
              }}
            />
            <PollActivitiesSection
              activities={activitiesForVoting}
              loading={activitiesLoading}
              onSelect={(activity) => {
                setActivityActionError("");
                setActivityActionNotice("");
                setSelectedPollDates([]);
                setSelectedActivityId(activity.id);
              }}
            />
            <AnnouncementFeedSection
              welcomeAnnouncement={welcomeAnnouncement}
              announcements={content?.announcements ?? []}
              contentError={contentError}
              actionError={announcementActionError}
              actionLoading={announcementActionLoading}
              onRetry={() => void loadContent()}
              onEdit={(announcement) => {
                setAnnouncementActionError("");
                setEditingAnnouncement(announcement);
              }}
              onDelete={(announcement) => void deleteAnnouncement(announcement)}
            />
          </section>
        ) : initialView === "announcement-create" ? (
          <section className="announcement-create-page">
            <Link className="text-link announcement-back-link" href="/activities">← Quay lại hoạt động</Link>
            <div className="announcement-create-panel">
              <div className="eyebrow"><span className="eyebrow-dot" /> CẬP NHẬT CỘNG ĐỒNG</div>
              <h1>Tạo thông báo<span className="hero-period">.</span></h1>
              <p>Chia sẻ tin tức và thông tin mới đến các thành viên câu lạc bộ.</p>
              <form className="activity-form" onSubmit={createAnnouncement}>
                <label htmlFor="announcement-category">Loại hoạt động</label>
                <select id="announcement-category" name="category" defaultValue="CÂU LẠC BỘ">
                  <option value="CÂU LẠC BỘ">Câu lạc bộ</option>
                  <option value="CẦU LÔNG">Cầu lông</option>
                  <option value="TỪ THIỆN">Từ thiện</option>
                  <option value="THỂ THAO">Thể thao</option>
                </select>
                <label htmlFor="announcement-title">Tiêu đề thông báo</label>
                <input id="announcement-title" name="title" placeholder="Nhập tiêu đề thông báo" minLength={3} maxLength={120} required />
                <label htmlFor="announcement-description">Nội dung thông báo</label>
                <textarea id="announcement-description" name="description" placeholder="Viết nội dung bạn muốn gửi đến các thành viên..." minLength={5} maxLength={1000} rows={6} required />
                {announcementFormError && <p className="modal-error" role="alert">{announcementFormError}</p>}
                <div className="announcement-form-actions">
                  <Link className="button-secondary" href="/activities">Hủy</Link>
                  <button className="button-primary" type="submit" disabled={announcementFormLoading}>
                    {announcementFormLoading ? "Đang đăng..." : "Đăng thông báo"}
                  </button>
                </div>
              </form>
            </div>
          </section>
        ) : null}

        {isCreateModalOpen && (
          <CreateActivityModal
            scheduleType={activityScheduleType}
            defaultDateTime={`${selectedDate}T18:00`}
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

        {selectedActivity && (
          <ActivityDetailsModal
            activity={selectedActivity}
            anchorDate={anchorDate}
            period={period}
            pollName={pollName}
            selectedPollDates={selectedPollDates}
            participantName={participantName}
            actionError={activityActionError}
            actionNotice={activityActionNotice}
            actionLoading={activityActionLoading}
            deletingParticipantName={deletingParticipantName}
            commentMessage={commentMessage}
            commentError={commentError}
            commentLoading={commentLoading}
            onMoveMonth={movePeriod}
            onPollNameChange={setPollName}
            onTogglePollDate={(date) =>
              setSelectedPollDates((current) =>
                current.includes(date)
                  ? current.filter((item) => item !== date)
                  : current.length < 14
                    ? [...current, date]
                    : current,
              )
            }
            onParticipantNameChange={setParticipantName}
            onVoteSubmit={voteForActivity}
            onJoinSubmit={joinActivity}
            onDeleteParticipant={(member) => void deleteActivityParticipant(member)}
            onCommentMessageChange={setCommentMessage}
            onCommentSubmit={addActivityComment}
            onDeleteActivity={() => void deleteActivity()}
            onClose={() => setSelectedActivityId(null)}
          />
        )}

        <ClubFooter />
      </div>
    </main>
  );
}
