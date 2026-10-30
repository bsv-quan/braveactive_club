"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ClubAnnouncement, ClubPost } from "@/lib/content";

type View = "overview" | "badminton";
type CalendarMode = "week" | "month";
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

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
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

export default function Home() {
  const [view, setView] = useState<View>("overview");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("week");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [name, setName] = useState("");
  const [content, setContent] = useState<ContentData | null>(null);
  const [registrations, setRegistrations] = useState<RegistrationData>({});
  const [contentError, setContentError] = useState("");
  const [calendarError, setCalendarError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const period = useMemo(() => {
    if (calendarMode === "week") {
      const start = startOfWeek(anchorDate);
      return Array.from({ length: 7 }, (_, index) => {
        const day = new Date(start);
        day.setDate(start.getDate() + index);
        return day;
      });
    }

    const first = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
    const mondayOffset = (first.getDay() + 6) % 7;
    const start = new Date(first);
    start.setDate(first.getDate() - mondayOffset);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [anchorDate, calendarMode]);

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

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  useEffect(() => {
    void loadRegistrations();
  }, [loadRegistrations]);

  const visibleDates = useMemo(() => {
    if (calendarMode === "week") return period;
    return period.filter((day) => day.getMonth() === anchorDate.getMonth());
  }, [anchorDate, calendarMode, period]);

  const membersForPeriod = useMemo(
    () =>
      visibleDates.flatMap((day) =>
        (registrations[dateKey(day)] ?? []).map((member) => ({
          date: dateKey(day),
          member,
        })),
      ),
    [registrations, visibleDates],
  );

  function movePeriod(direction: number) {
    const next = new Date(anchorDate);
    if (calendarMode === "week") next.setDate(next.getDate() + direction * 7);
    else next.setMonth(next.getMonth() + direction, 1);
    setAnchorDate(next);
  }

  function chooseCalendarMode(mode: CalendarMode) {
    setCalendarMode(mode);
    setAnchorDate(new Date(`${selectedDate}T00:00:00`));
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

  return (
    <main>
      <div className="page-shell">
        <header className="topbar">
          <a className="brand" href="#" onClick={() => setView("overview")}>
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </span>
            <span>brave<span className="brand-light">active</span></span>
          </a>
          <nav className="main-nav" aria-label="Điều hướng chính">
            <button
              className={view === "overview" ? "nav-link active" : "nav-link"}
              onClick={() => setView("overview")}
            >
              Tổng quan
            </button>
            <button
              className={view === "badminton" ? "nav-link active" : "nav-link"}
              onClick={() => setView("badminton")}
            >
              Cầu lông
            </button>
            <a className="nav-link" href="#activities">Hoạt động</a>
          </nav>
          <a className="join-button" href="#activities">
            <span>+</span> Tham gia câu lạc bộ
          </a>
        </header>

        {view === "overview" ? (
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
                  <button className="button-primary" onClick={() => setView("badminton")}>
                    Đăng ký cầu lông <span aria-hidden="true">↗</span>
                  </button>
                  <a className="text-link" href="#activities">Khám phá hoạt động <span>↓</span></a>
                </div>
                <div className="hero-social">
                  <div className="avatar-stack" aria-hidden="true">
                    <span className="avatar avatar-one">L</span>
                    <span className="avatar avatar-two">M</span>
                    <span className="avatar avatar-three">A</span>
                    <span className="avatar avatar-four">+</span>
                  </div>
                  <div><strong>Tham gia cùng chúng mình</strong><small>Mỗi ngày đều là một khởi đầu mới</small></div>
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
              <button className="activity-card badminton-card" onClick={() => setView("badminton")}>
                <span className="card-icon">↗</span>
                <span className="card-number">01 — VẬN ĐỘNG</span>
                <strong>Cầu lông</strong>
                <span className="card-description">Hẹn nhau trên sân, vui hết mình.</span>
                <span className="card-arrow">↗</span>
              </button>
              <a className="activity-card charity-card" href="#posts">
                <span className="card-icon">♡</span>
                <span className="card-number">02 — SẺ CHIA</span>
                <strong>Từ thiện</strong>
                <span className="card-description">Góp sức nhỏ, lan tỏa điều tốt.</span>
                <span className="card-arrow">↗</span>
              </a>
              <a className="activity-card sport-card" href="#posts">
                <span className="card-icon">✳</span>
                <span className="card-number">03 — NĂNG LƯỢNG</span>
                <strong>Thể thao</strong>
                <span className="card-description">Khám phá hoạt động mới mỗi tuần.</span>
                <span className="card-arrow">↗</span>
              </a>
            </section>

            <section className="updates-section" id="posts">
              <div className="updates-heading">
                <div>
                  <span className="section-kicker">BẢNG TIN CÂU LẠC BỘ</span>
                  <h2>Tin mới & thông báo<span className="hero-period">.</span></h2>
                </div>
                <span className="updates-note">Luôn cập nhật những điều đang diễn ra</span>
              </div>
              {contentError ? (
                <div className="error-panel" role="alert">
                  <span>Chưa thể kết nối bảng tin</span>
                  <p>{contentError}</p>
                  <button className="button-quiet" onClick={() => void loadContent()}>Thử tải lại ↻</button>
                </div>
              ) : !content ? (
                <div className="loading-panel">Đang tải bảng tin...</div>
              ) : (
                <>
                  <div className="announcement-grid">
                    {content.announcements.map((item) => (
                      <article className={`announcement announcement-${item.color}`} key={item.id}>
                        <div className="announcement-top">
                          <span>{item.category}</span><span>{formatDate(new Date(`${item.date}T00:00:00`), { day: "2-digit", month: "2-digit" })}</span>
                        </div>
                        <h3>{item.title}</h3>
                        <p>{item.description}</p>
                        <span className="announcement-mark">✳</span>
                      </article>
                    ))}
                  </div>
                  <div className="post-list">
                    {content.posts.map((post, index) => (
                      <article className="post-row" key={post.id}>
                        <span className={`post-index post-index-${index + 1}`}>0{index + 1}</span>
                        <div className="post-copy">
                          <span className={`category-label ${categoryColor(post.category)}`}>{post.category}</span>
                          <h3>{post.title}</h3>
                          <p>{post.description}</p>
                        </div>
                        <div className="post-meta">
                          <span>{formatDate(new Date(`${post.date}T00:00:00`), { day: "2-digit", month: "2-digit", year: "numeric" })}</span>
                          <small>{post.readTime}</small>
                        </div>
                        <span className="post-arrow">↗</span>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </section>
          </>
        ) : (
          <section className="calendar-page">
            <div className="calendar-title-row">
              <div>
                <div className="eyebrow"><span className="eyebrow-dot" /> CÙNG NHAU TRÊN SÂN</div>
                <h1>Lịch cầu lông<span className="hero-period">.</span></h1>
                <p>Chọn một ngày, nhập tên và hẹn gặp nhau trên sân nhé.</p>
              </div>
              <div className="calendar-badge"><span>✳</span><div><strong>Mọi trình độ</strong><small>đều được chào đón</small></div></div>
            </div>

            <div className="calendar-layout">
              <section className="calendar-panel">
                <div className="calendar-toolbar">
                  <div className="month-navigation">
                    <button className="icon-button" aria-label="Kỳ trước" onClick={() => movePeriod(-1)}>‹</button>
                    <h2>{formatMonth(anchorDate)}</h2>
                    <button className="icon-button" aria-label="Kỳ sau" onClick={() => movePeriod(1)}>›</button>
                  </div>
                  <div className="mode-switch" aria-label="Chế độ lịch">
                    <button className={calendarMode === "week" ? "selected" : ""} onClick={() => chooseCalendarMode("week")}>Tuần</button>
                    <button className={calendarMode === "month" ? "selected" : ""} onClick={() => chooseCalendarMode("month")}>Tháng</button>
                  </div>
                </div>
                <div className={`calendar-grid ${calendarMode}`}>
                  {weekdayNames.map((day) => <span className="weekday" key={day}>{day}</span>)}
                  {period.map((day) => {
                    const key = dateKey(day);
                    const active = selectedDate === key;
                    const outsideMonth = calendarMode === "month" && day.getMonth() !== anchorDate.getMonth();
                    const hasMembers = (registrations[key] ?? []).length > 0;
                    return (
                      <button
                        key={key}
                        className={`day-cell ${active ? "day-selected" : ""} ${outsideMonth ? "day-outside" : ""} ${key === dateKey(new Date()) ? "day-today" : ""}`}
                        onClick={() => setSelectedDate(key)}
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
                    <div><strong>Danh sách đăng ký</strong><span>{calendarMode === "week" ? "Trong tuần này" : "Trong tháng này"}</span></div>
                    <span className="member-count">{membersForPeriod.length}</span>
                  </div>
                  {membersForPeriod.length ? (
                    <ul className="member-list">
                      {membersForPeriod.map(({ date, member }, index) => (
                        <li key={`${date}-${member}`}>
                          <span className={`member-avatar member-avatar-${index % 4}`}>{member.trim().charAt(0).toLocaleUpperCase("vi")}</span>
                          <span className="member-name">{member}</span>
                          <span className="member-date">{formatDate(new Date(`${date}T00:00:00`), { day: "2-digit", month: "2-digit" })}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="empty-members"><span>☀</span><p>Chưa có ai đăng ký trong khoảng thời gian này.</p><small>Hãy là người đầu tiên nhé!</small></div>
                  )}
                </div>
                <div className="signup-footnote"><span>♡</span> Chơi vui, chơi đẹp, cùng nhau tiến bộ.</div>
              </aside>
            </div>
          </section>
        )}

        <footer className="footer">
          <a className="brand footer-brand" href="#" onClick={() => setView("overview")}>
            <span className="brand-mark" aria-hidden="true"><span /><span /><span /><span /></span>
            <span>brave<span className="brand-light">active</span></span>
          </a>
          <span>Được tạo nên bởi những người thích cùng nhau vận động.</span>
          <span>© 2026 Brave Active Club</span>
        </footer>
      </div>
    </main>
  );
}
