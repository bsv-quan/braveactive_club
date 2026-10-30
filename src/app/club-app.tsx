"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClubActivity } from "@/lib/activities";
import {
  initialAnnouncements,
  type ClubAnnouncement,
  type ClubPost,
} from "@/lib/content";

type View = "overview" | "badminton" | "activities" | "announcement-create";
type ContentData = {
  announcements: ClubAnnouncement[];
  posts: ClubPost[];
};
type RegistrationData = Record<string, string[]>;

const weekdayNames = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const weekdayLong = ["Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy", "Chủ Nhật"];

function dateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatMonth(date: Date) {
  return new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" }).format(date);
}

function formatDate(date: Date, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("vi-VN", options).format(date);
}

function prettyDate(date: string) {
  return formatDate(new Date(`${date}T00:00:00`), {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function categoryColor(category: string) {
  if (category === "CẦU LÔNG") return "coral";
  if (category === "TỪ THIỆN") return "violet";
  return "green";
}

export default function ClubApp({ initialView }: { initialView: View }) {
  const router = useRouter();
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [name, setName] = useState("");
  const [content, setContent] = useState<ContentData | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationData>({});
  const [contentError, setContentError] = useState("");
  const [calendarError, setCalendarError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activityCategory, setActivityCategory] = useState("Tất cả");
  const [activities, setActivities] = useState<ClubActivity[]>([]);
  const [activitiesError, setActivitiesError] = useState("");
  const [activitiesLoading, setActivitiesLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [activityFormError, setActivityFormError] = useState("");
  const [activityFormLoading, setActivityFormLoading] = useState(false);
  const [participantName, setParticipantName] = useState("");
  const [activityActionError, setActivityActionError] = useState("");
  const [activityActionNotice, setActivityActionNotice] = useState("");
  const [activityActionLoading, setActivityActionLoading] = useState(false);
  const [deletingRegistrationName, setDeletingRegistrationName] = useState("");
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

  const range = useMemo(
    () => ({ from: dateKey(period[0]), to: dateKey(period[period.length - 1]) }),
    [period],
  );

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

  const loadRegistrations = useCallback(async () => {
    try {
      const query = new URLSearchParams(range);
      const response = await fetch(`/api/badminton?${query}`);
      const data = (await response.json()) as {
        registrations?: RegistrationData;
        error?: string;
      };
      if (!response.ok) throw new Error(data.error ?? "Không thể tải danh sách.");
      setRegistrations(data.registrations ?? {});
      setCalendarError("");
    } catch (error) {
      setCalendarError(
        error instanceof Error ? error.message : "Không thể tải danh sách.",
      );
    }
  }, [range]);

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
    if (initialView === "badminton") {
      void loadRegistrations();
    }
  }, [initialView, loadRegistrations]);

  useEffect(() => {
    if (initialView === "overview" || initialView === "activities") {
      void loadActivities();
    }
  }, [initialView, loadActivities]);

  const membersForSelectedDate = registrations[selectedDate] ?? [];
  const latestAnnouncements = [...(content?.announcements ?? [])]
    .sort((first, second) => second.date.localeCompare(first.date))
    .slice(0, 3);
  const latestActivities = activities.slice(0, 2);
  const selectedActivity = activities.find(
    (activity) => activity.id === selectedActivityId,
  );
  const filteredActivities = activities.filter(
    (activity) =>
      activityCategory === "Tất cả" || activity.category === activityCategory,
  );
  function movePeriod(direction: number) {
    const next = new Date(anchorDate);
    next.setMonth(next.getMonth() + direction, 1);
    setAnchorDate(next);
  }

  async function register(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setIsLoading(true);
    try {
      const response = await fetch("/api/badminton", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, name }),
      });
      const data = (await response.json()) as { name?: string; error?: string };
      if (!response.ok) throw new Error(data.error ?? "Đăng ký chưa thành công.");
      setName("");
      setNotice(`Đã đăng ký cho ${prettyDate(selectedDate)}. Hẹn gặp bạn!`);
      await loadRegistrations();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Đăng ký chưa thành công.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function createActivity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActivityFormError("");
    setActivityFormLoading(true);
    const formData = new FormData(event.currentTarget);
    const localDate = String(formData.get("date") ?? "");

    try {
      const response = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: formData.get("title"),
          description: formData.get("description"),
          category: formData.get("category"),
          date: new Date(localDate).toISOString(),
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
        [...current, { ...createdActivity, participants: [] }].sort((a, b) =>
          b.createdAt.localeCompare(a.createdAt),
        ),
      );
      setIsCreateModalOpen(false);
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

  async function deleteBadmintonRegistration(member: string) {
    if (!window.confirm(`Xóa đăng ký cầu lông của "${member}" vào ${prettyDate(selectedDate)}?`)) {
      return;
    }

    setDeletingRegistrationName(member);
    setNotice("");
    try {
      const response = await fetch("/api/badminton", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, name: member }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Không thể xóa đăng ký.");
      setNotice(`Đã xóa đăng ký của ${member}.`);
      await loadRegistrations();
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Không thể xóa đăng ký.",
      );
    } finally {
      setDeletingRegistrationName("");
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
        <header className="topbar">
          <Link className="brand" href="/">
            <img className="brand-logo" src="/logos/braveactive.png" alt="Brave Active" />
          </Link>
          <nav className="main-nav" aria-label="Điều hướng chính">
            <Link
              className={initialView === "overview" ? "nav-link active" : "nav-link"}
              href="/"
            >
              Tổng quan
            </Link>
            <Link
              className={initialView === "badminton" ? "nav-link active" : "nav-link"}
              href="/badminton"
            >
              Cầu lông
            </Link>
            <Link
              className={initialView === "activities" || initialView === "announcement-create" ? "nav-link active" : "nav-link"}
              href="/activities"
            >
              Hoạt động
            </Link>
          </nav>
          <button
            className="join-button"
            type="button"
            onClick={() => {
              setActivityFormError("");
              setIsCreateModalOpen(true);
            }}
          >
            <span>+</span> Tạo hoạt động
          </button>
        </header>

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
                  <Link className="button-primary" href="/badminton">
                    Đăng ký cầu lông <span aria-hidden="true">↗</span>
                  </Link>
                  <Link className="text-link" href="/activities">Khám phá hoạt động <span>↓</span></Link>
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
              </div>
              <Link className="activity-card badminton-card" href="/badminton">
                <span className="card-icon">↗</span>
                <span className="card-number">01 — VẬN ĐỘNG</span>
                <strong>Cầu lông</strong>
                <span className="card-description">Hẹn nhau trên sân, vui hết mình.</span>
                <span className="card-arrow">↗</span>
              </Link>
              <Link className="activity-card charity-card" href="/activities">
                <span className="card-icon">♡</span>
                <span className="card-number">02 — SẺ CHIA</span>
                <strong>Từ thiện</strong>
                <span className="card-description">Góp sức nhỏ, lan tỏa điều tốt.</span>
                <span className="card-arrow">↗</span>
              </Link>
              <Link className="activity-card sport-card" href="/activities">
                <span className="card-icon">✳</span>
                <span className="card-number">03 — NĂNG LƯỢNG</span>
                <strong>Thể thao</strong>
                <span className="card-description">Khám phá hoạt động mới mỗi tuần.</span>
                <span className="card-arrow">↗</span>
              </Link>
            </section>

            <section className="home-news-section">
              <div className="home-news-heading">
                <div>
                  <span className="section-kicker">CẬP NHẬT TỪ CÂU LẠC BỘ</span>
                  <h2>Bản tin hoạt động<span className="hero-period">.</span></h2>
                </div>
                <Link className="text-link" href="/activities">
                  Xem tất cả <span>↗</span>
                </Link>
              </div>
              <div className="home-news-columns">
                <section className="home-news-column" aria-labelledby="home-announcements-title">
                  <div className="home-news-column-heading">
                    <h3 id="home-announcements-title">Thông báo mới nhất</h3>
                    <span>{latestAnnouncements.length}/3</span>
                  </div>
                  {contentError ? (
                    <div className="home-news-message" role="alert">
                      <p>{contentError}</p>
                      <button className="button-quiet" onClick={() => void loadContent()}>
                        Thử tải lại ↻
                      </button>
                    </div>
                  ) : !content ? (
                    <div className="home-news-message">Đang tải thông báo...</div>
                  ) : latestAnnouncements.length ? (
                    <div className="home-news-list">
                      {latestAnnouncements.map((announcement) => (
                        <article
                          className={`home-news-item home-news-${announcement.color}`}
                          key={announcement.id}
                        >
                          <span className="home-news-item-icon">✳</span>
                          <div>
                            <span className={`category-label ${categoryColor(announcement.category)}`}>
                              {announcement.category}
                            </span>
                            <h4>{announcement.title}</h4>
                            <p>{announcement.description}</p>
                            <time dateTime={announcement.date}>
                              {formatDate(new Date(`${announcement.date}T00:00:00`), {
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              })}
                            </time>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="home-news-message">Chưa có thông báo mới.</div>
                  )}
                </section>

                <section className="home-news-column" aria-labelledby="home-activities-title">
                  <div className="home-news-column-heading">
                    <h3 id="home-activities-title">Hoạt động mới nhất</h3>
                    <span>{latestActivities.length}/2</span>
                  </div>
                  {activitiesError ? (
                    <div className="home-news-message" role="alert">
                      <p>{activitiesError}</p>
                      <button className="button-quiet" onClick={() => void loadActivities()}>
                        Thử tải lại ↻
                      </button>
                    </div>
                  ) : activitiesLoading ? (
                    <div className="home-news-message">Đang tải hoạt động...</div>
                  ) : latestActivities.length ? (
                    <div className="home-news-list">
                      {latestActivities.map((activity) => (
                        <button
                          className="home-news-item home-news-activity"
                          key={activity.id}
                          type="button"
                          onClick={() => {
                            setActivityActionError("");
                            setActivityActionNotice("");
                            setSelectedActivityId(activity.id);
                          }}
                        >
                          <span className="home-news-item-icon">↗</span>
                          <span className="home-news-activity-copy">
                            <span className={`category-label ${categoryColor(activity.category)}`}>
                              {activity.category}
                            </span>
                            <strong>{activity.title}</strong>
                            <span className="home-news-description">{activity.description}</span>
                            <span className="home-news-activity-meta">
                              {formatDate(new Date(activity.date), {
                                day: "numeric",
                                month: "long",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              <span>{activity.participants.length} người tham gia</span>
                            </span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="home-news-message">
                      Chưa có hoạt động mới.{" "}
                      <Link href="/activities">Khám phá hoạt động ↗</Link>
                    </div>
                  )}
                </section>
              </div>
            </section>
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
            <section className="scheduled-activities">
              <div className="scheduled-heading">
                <div>
                  <span className="section-kicker">CÙNG NHAU THAM GIA</span>
                  <h2>Hoạt động mới nhất<span className="hero-period">.</span></h2>
                </div>
                <button
                  className="button-primary"
                  type="button"
                  onClick={() => {
                    setActivityFormError("");
                    setIsCreateModalOpen(true);
                  }}
                >
                  <span className="create-button-plus">+</span> Tạo hoạt động
                </button>
              </div>
              {activitiesError ? (
                <div className="error-panel" role="alert">
                  <span>Chưa thể tải danh sách hoạt động</span>
                  <p>{activitiesError}</p>
                  <button className="button-quiet" onClick={() => void loadActivities()}>Thử tải lại ↻</button>
                </div>
              ) : activitiesLoading ? (
                <div className="loading-panel">Đang tải hoạt động...</div>
              ) : filteredActivities.length ? (
                <div className="activity-feed">
                  {filteredActivities.map((activity, index) => (
                    <button
                      className="activity-feed-card activity-feed-button"
                      key={activity.id}
                      type="button"
                      onClick={() => {
                        setActivityActionError("");
                        setActivityActionNotice("");
                        setSelectedActivityId(activity.id);
                      }}
                    >
                      <span className="feed-index">{String(index + 1).padStart(2, "0")}</span>
                      <span className="feed-card-main">
                        <span className="feed-card-meta">
                          <span className={`category-label ${categoryColor(activity.category)}`}>{activity.category}</span>
                          <span className="feed-kind">HOẠT ĐỘNG MỚI</span>
                        </span>
                        <strong className="activity-feed-title">{activity.title}</strong>
                        <span className="activity-feed-description">{activity.description}</span>
                        <span className="feed-card-footer">
                          <span>{formatDate(new Date(activity.date), { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                          <span>Tạo bởi {activity.creator}</span>
                          <span>{activity.participants.length} người tham gia</span>
                        </span>
                      </span>
                      <span className="feed-card-action" aria-hidden="true">↗</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="empty-feed">
                  <span>✳</span>
                  <strong>{activities.length ? "Không có hoạt động trong mục này" : "Chưa có hoạt động mới"}</strong>
                  <p>{activities.length ? "Hãy chọn một bộ lọc khác." : "Hoạt động mới sẽ xuất hiện tại đây."}</p>
                </div>
              )}
            </section>
            <section className="activity-notifications">
              <div className="scheduled-heading">
                <div>
                  <span className="section-kicker">THÔNG TIN TỪ CÂU LẠC BỘ</span>
                  <h2>Thông báo hoạt động<span className="hero-period">.</span></h2>
                </div>
                <Link className="button-primary" href="/activities/announcements/new">
                  <span className="create-button-plus">+</span> Tạo thông báo
                </Link>
              </div>
              <div className="activity-feed">
                {welcomeAnnouncement && (
                  <article className="activity-feed-card feed-mint welcome-feed-card">
                    <span className="feed-index">✳</span>
                    <div className="feed-card-main">
                      <div className="feed-card-meta">
                        <span className="category-label green">{welcomeAnnouncement.category}</span>
                        <span className="feed-kind">CHÀO MỪNG</span>
                      </div>
                      <h2>{welcomeAnnouncement.title}</h2>
                      <p>{welcomeAnnouncement.description}</p>
                    </div>
                  </article>
                )}
                {contentError ? (
                  <div className="error-panel" role="alert">
                    <span>Chưa thể tải các thông báo mới</span>
                    <p>{contentError}</p>
                    <button className="button-quiet" onClick={() => void loadContent()}>Thử tải lại ↻</button>
                  </div>
                ) : (
                  <>
                    {(content?.announcements ?? [])
                      .filter((announcement) => announcement.id !== "welcome")
                      .map((announcement) => (
                        <article
                          className={`activity-feed-card feed-${announcement.color}`}
                          key={announcement.id}
                        >
                          <span className="feed-index">✳</span>
                          <div className="feed-card-main">
                            <div className="feed-card-meta">
                              <span className={`category-label ${categoryColor(announcement.category)}`}>{announcement.category}</span>
                              <span className="feed-kind">THÔNG BÁO MỚI</span>
                            </div>
                            <h2>{announcement.title}</h2>
                            <p>{announcement.description}</p>
                            <div className="feed-card-footer">
                              <time dateTime={announcement.date}>{formatDate(new Date(`${announcement.date}T00:00:00`), { day: "numeric", month: "long", year: "numeric" })}</time>
                            </div>
                          </div>
                          <div className="announcement-actions">
                            <button
                              className="announcement-action edit"
                              type="button"
                              onClick={() => {
                                setAnnouncementActionError("");
                                setEditingAnnouncement(announcement);
                              }}
                            >
                              Sửa
                            </button>
                            <button
                              className="announcement-action delete"
                              type="button"
                              disabled={announcementActionLoading}
                              onClick={() => void deleteAnnouncement(announcement)}
                            >
                              Xóa
                            </button>
                          </div>
                        </article>
                      ))}
                    {announcementActionError && (
                      <p className="announcement-action-error" role="alert">
                        {announcementActionError}
                      </p>
                    )}
                  </>
                )}
              </div>
            </section>
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
        ) : (
          <section className="calendar-page">
            <div className="calendar-title-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-dot" /> CÙNG NHAU TRÊN SÂN</div>
                <h1>Lịch cầu lông<span className="hero-period">.</span></h1>
                <p>Chọn một ngày, nhập tên và hẹn gặp nhau trên sân nhé.</p>
              </div>
            </div>

            <div className="calendar-layout">
              <section className="calendar-panel">
                <div className="calendar-toolbar">
                  <div className="month-navigation">
                    <button className="icon-button" aria-label="Kỳ trước" onClick={() => movePeriod(-1)}>‹</button>
                    <h2>{formatMonth(anchorDate)}</h2>
                    <button className="icon-button" aria-label="Kỳ sau" onClick={() => movePeriod(1)}>›</button>
                  </div>
                </div>
                <div className="calendar-grid month">
                  {weekdayNames.map((day) => <span className="weekday" key={day}>{day}</span>)}
                  {period.map((day) => {
                    const key = dateKey(day);
                    const active = selectedDate === key;
                    const outsideMonth = day.getMonth() !== anchorDate.getMonth();
                    const hasMembers = (registrations[key] ?? []).length > 0;
                    return (
                      <button
                        key={key}
                        className={`day-cell ${active ? "day-selected" : ""} ${outsideMonth ? "day-outside" : ""} ${key === dateKey(new Date()) ? "day-today" : ""}`}
                        onClick={() => {
                          setSelectedDate(key);
                          if (outsideMonth) setAnchorDate(day);
                        }}
                        aria-pressed={active}
                        aria-label={`${weekdayLong[(day.getDay() + 6) % 7]}, ${formatDate(day, { day: "numeric", month: "long" })}${hasMembers ? `, ${registrations[key].length} người đã đăng ký` : ""}`}
                      >
                        <span>{day.getDate()}</span>
                        {hasMembers && <i className="day-indicator" aria-hidden="true" />}
                      </button>
                    );
                  })}
                </div>
                <div className="calendar-legend"><span><i className="legend-dot active-dot" /> Ngày đã chọn</span><span><i className="legend-dot registered-dot" /> Có người đăng ký</span></div>
              </section>

              <aside className="signup-panel">
                <div className="signup-date">
                  <span className="section-kicker">NGÀY ĐÃ CHỌN</span>
                  <h2>{formatDate(new Date(`${selectedDate}T00:00:00`), { day: "2-digit" })}</h2>
                  <div><strong>{weekdayLong[(new Date(`${selectedDate}T00:00:00`).getDay() + 6) % 7]}</strong><span>{formatDate(new Date(`${selectedDate}T00:00:00`), { month: "long", year: "numeric" })}</span></div>
                </div>
                <form className="signup-form" onSubmit={register}>
                  <label htmlFor="member-name">Tên của bạn</label>
                  <div className="input-row">
                    <input id="member-name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nhập tên để đăng ký" maxLength={40} required minLength={2} />
                    <button className="button-primary" type="submit" disabled={isLoading}>{isLoading ? "..." : "Đăng ký"}</button>
                  </div>
                  <small>Tên sẽ hiển thị với các thành viên khác.</small>
                </form>
                {notice && <p className="form-notice" role="status">{notice}</p>}
                {calendarError ? (
                  <div className="inline-error" role="alert">
                    <strong>Chưa tải được danh sách</strong>
                    <span>{calendarError}</span>
                    <button className="button-quiet" onClick={() => void loadRegistrations()}>Thử lại ↻</button>
                  </div>
                ) : null}
                <div className="members-section">
                  <div className="members-heading">
                    <div><strong>Danh sách đăng ký</strong><span>{formatMonth(new Date(`${selectedDate}T00:00:00`))} · {prettyDate(selectedDate)}</span></div>
                    <span className="member-count">{membersForSelectedDate.length}</span>
                  </div>
                  {membersForSelectedDate.length ? (
                    <ul className="member-list">
                      {membersForSelectedDate.map((member, index) => (
                        <li key={`${selectedDate}-${member}`}>
                          <span className={`member-avatar member-avatar-${index % 4}`}>{member.trim().charAt(0).toLocaleUpperCase("vi")}</span>
                          <span className="member-name">{member}</span>
                          <button
                            className="remove-member-button"
                            type="button"
                            aria-label={`Xóa đăng ký của ${member}`}
                            title={`Xóa đăng ký của ${member}`}
                            disabled={deletingRegistrationName === member}
                            onClick={() => void deleteBadmintonRegistration(member)}
                          >
                            {deletingRegistrationName === member ? "…" : "×"}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="empty-members"><span>☀</span><p>Chưa có ai đăng ký trong ngày này.</p><small>Hãy là người đầu tiên nhé!</small></div>
                  )}
                </div>
                <div className="signup-footnote"><span>♡</span> Chơi vui, chơi đẹp, cùng nhau tiến bộ.</div>
              </aside>
            </div>
          </section>
        )}

        {isCreateModalOpen && (
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setIsCreateModalOpen(false);
              }
            }}
          >
            <section
              className="activity-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="create-activity-title"
            >
              <button
                className="modal-close"
                type="button"
                aria-label="Đóng"
                onClick={() => setIsCreateModalOpen(false)}
              >
                ×
              </button>
              <span className="section-kicker">THÊM VÀO LỊCH CÂU LẠC BỘ</span>
              <h2 id="create-activity-title">Tạo hoạt động<span className="hero-period">.</span></h2>
              <p className="modal-intro">Chia sẻ kế hoạch của bạn để mọi người cùng tham gia.</p>
              <form className="activity-form" onSubmit={createActivity}>
                <label htmlFor="activity-title">Tên hoạt động</label>
                <input id="activity-title" name="title" placeholder="Ví dụ: Giao lưu cầu lông cuối tuần" minLength={3} maxLength={120} required />
                <label htmlFor="activity-description">Nội dung hoạt động</label>
                <textarea id="activity-description" name="description" placeholder="Mô tả hoạt động, địa điểm hoặc điều cần chuẩn bị..." minLength={5} maxLength={1000} rows={4} required />
                <div className="activity-form-row">
                  <div>
                    <label htmlFor="activity-category">Loại hoạt động</label>
                    <select id="activity-category" name="category" defaultValue="THỂ THAO">
                      <option value="CẦU LÔNG">Cầu lông</option>
                      <option value="TỪ THIỆN">Từ thiện</option>
                      <option value="THỂ THAO">Thể thao</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="activity-date">Lịch diễn ra</label>
                    <input id="activity-date" name="date" type="datetime-local" required />
                  </div>
                </div>
                <label htmlFor="activity-creator">Tên người tạo hoạt động</label>
                <input id="activity-creator" name="creator" placeholder="Tên bạn" minLength={2} maxLength={40} required />
                {activityFormError && <p className="modal-error" role="alert">{activityFormError}</p>}
                <button className="button-primary modal-submit" type="submit" disabled={activityFormLoading}>
                  {activityFormLoading ? "Đang tạo..." : "Tạo hoạt động"}
                </button>
              </form>
            </section>
          </div>
        )}

        {editingAnnouncement && (
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget && !announcementActionLoading) {
                setEditingAnnouncement(null);
              }
            }}
          >
            <section
              className="activity-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="edit-announcement-title"
            >
              <button
                className="modal-close"
                type="button"
                aria-label="Đóng"
                disabled={announcementActionLoading}
                onClick={() => setEditingAnnouncement(null)}
              >
                ×
              </button>
              <span className="section-kicker">CẬP NHẬT BẢNG TIN</span>
              <h2 id="edit-announcement-title">Sửa thông báo<span className="hero-period">.</span></h2>
              <form className="activity-form" onSubmit={editAnnouncement}>
                <label htmlFor="edit-announcement-category">Loại hoạt động</label>
                <select
                  id="edit-announcement-category"
                  name="category"
                  defaultValue={editingAnnouncement.category}
                >
                  <option value="CÂU LẠC BỘ">Câu lạc bộ</option>
                  <option value="CẦU LÔNG">Cầu lông</option>
                  <option value="TỪ THIỆN">Từ thiện</option>
                  <option value="THỂ THAO">Thể thao</option>
                </select>
                <label htmlFor="edit-announcement-title">Tiêu đề thông báo</label>
                <input
                  id="edit-announcement-title"
                  name="title"
                  defaultValue={editingAnnouncement.title}
                  minLength={3}
                  maxLength={120}
                  required
                />
                <label htmlFor="edit-announcement-description">Nội dung thông báo</label>
                <textarea
                  id="edit-announcement-description"
                  name="description"
                  defaultValue={editingAnnouncement.description}
                  minLength={5}
                  maxLength={1000}
                  rows={5}
                  required
                />
                {announcementActionError && (
                  <p className="modal-error" role="alert">{announcementActionError}</p>
                )}
                <div className="announcement-form-actions">
                  <button
                    className="button-secondary"
                    type="button"
                    disabled={announcementActionLoading}
                    onClick={() => setEditingAnnouncement(null)}
                  >
                    Hủy
                  </button>
                  <button
                    className="button-primary"
                    type="submit"
                    disabled={announcementActionLoading}
                  >
                    {announcementActionLoading ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {selectedActivity && (
          <div
            className="modal-backdrop"
            role="presentation"
            onClick={(event) => {
              if (event.target === event.currentTarget && !activityActionLoading) {
                setSelectedActivityId(null);
              }
            }}
          >
            <section
              className="activity-modal activity-detail-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="activity-detail-title"
            >
              <button
                className="modal-close"
                type="button"
                aria-label="Đóng"
                onClick={() => setSelectedActivityId(null)}
              >
                ×
              </button>
              <span className={`category-label ${categoryColor(selectedActivity.category)}`}>{selectedActivity.category}</span>
              <h2 id="activity-detail-title">{selectedActivity.title}</h2>
              <p className="activity-detail-description">{selectedActivity.description}</p>
              <div className="activity-detail-meta">
                <div><span>LỊCH DIỄN RA</span><strong>{formatDate(new Date(selectedActivity.date), { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</strong></div>
                <div><span>NGƯỜI TẠO</span><strong>{selectedActivity.creator}</strong></div>
              </div>
              <form className="activity-form join-activity-form" onSubmit={joinActivity}>
                <label htmlFor="participant-name">Tên của bạn để tham gia</label>
                <div className="join-activity-row">
                  <input id="participant-name" value={participantName} onChange={(event) => setParticipantName(event.target.value)} placeholder="Nhập tên của bạn" minLength={2} maxLength={40} required />
                  <button className="button-primary" type="submit" disabled={activityActionLoading}>
                    {activityActionLoading ? "..." : "Tham gia hoạt động"}
                  </button>
                </div>
              </form>
              {activityActionNotice && <p className="activity-action-notice" role="status">{activityActionNotice}</p>}
              {activityActionError && <p className="modal-error" role="alert">{activityActionError}</p>}
              <div className="activity-participants">
                <div className="participants-heading"><strong>Thành viên tham gia</strong><span>{selectedActivity.participants.length}</span></div>
                {selectedActivity.participants.length ? (
                  <ul>
                    {selectedActivity.participants.map((participant, index) => (
                      <li key={`${selectedActivity.id}-${participant}`}>
                        <span className={`member-avatar member-avatar-${index % 4}`}>{participant.charAt(0).toLocaleUpperCase("vi")}</span>
                        <span className="participant-name">{participant}</span>
                        <button
                          className="remove-member-button"
                          type="button"
                          aria-label={`Xóa ${participant} khỏi hoạt động`}
                          title={`Xóa ${participant} khỏi hoạt động`}
                          disabled={deletingParticipantName === participant || activityActionLoading}
                          onClick={() => void deleteActivityParticipant(participant)}
                        >
                          {deletingParticipantName === participant ? "…" : "×"}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="no-activity-participants">Chưa có ai tham gia. Bạn sẽ là người đầu tiên chứ?</p>
                )}
              </div>
              <div className="activity-delete-row">
                <span>Ai cũng có thể xóa hoạt động này.</span>
                <button
                  className="delete-activity-button"
                  type="button"
                  onClick={() => void deleteActivity()}
                  disabled={activityActionLoading}
                >
                  Xóa hoạt động
                </button>
              </div>
            </section>
          </div>
        )}

        <footer className="footer">
          <Link className="brand footer-brand" href="/">
            <img className="brand-logo footer-logo" src="/logos/bravesoft.png" alt="BraveSoft" />
          </Link>
          <span>Được tạo nên bởi những người thích cùng nhau vận động.</span>
          <span>© 2026 Brave Active Club</span>
        </footer>
      </div>
    </main>
  );
}
