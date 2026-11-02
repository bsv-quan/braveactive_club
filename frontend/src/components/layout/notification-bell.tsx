"use client";

import { Bell, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { communityApi, type NotificationPage, type UserNotification } from "@/lib/api/community";
import { errorMessage } from "@/lib/api/client";
import { formatRelativeTime } from "@/lib/format";
import { useI18n } from "@/i18n/i18n-provider";
import { useFeedEvents } from "@/lib/use-feed-events";

function notificationMessage(
  notification: UserNotification,
  t: ReturnType<typeof useI18n>["t"],
) {
  const keys = {
    new_post: "notifications.items.newPost",
    post_liked_own: "notifications.items.postLikedOwn",
    post_liked_followed: "notifications.items.postLikedFollowed",
    post_commented_own: "notifications.items.postCommentedOwn",
    post_commented_followed: "notifications.items.postCommentedFollowed",
  } as const;
  return t(keys[notification.kind], {
    actor: notification.actorName,
    context: notification.context,
  });
}

export function NotificationBell({ userId }: { userId: string }) {
  const { t, intlLocale } = useI18n();
  const router = useRouter();
  const wrapper = useRef<HTMLDivElement>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<UserNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const page: NotificationPage = await communityApi.listNotifications();
      setItems(page.notifications);
      setUnreadCount(page.unreadCount);
    } catch (reason) {
      setError(errorMessage(reason, t("notifications.loadError")));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications, userId]);

  const handleFeedEvent = useCallback(
    (event: import("@/lib/api/community").FeedEvent) => {
      if (event.type !== "notification.created") return;
      setUnreadCount(event.unreadCount);
      if (open) void loadNotifications();
    },
    [loadNotifications, open],
  );
  const handleReconnect = useCallback(() => {
    void loadNotifications();
  }, [loadNotifications]);
  useFeedEvents(handleFeedEvent, handleReconnect);

  const closeAndRead = useCallback(async () => {
    setOpen(false);
    const ids = items.map((item) => item.id);
    if (!ids.length) return;
    try {
      const result = await communityApi.markNotificationsRead(ids);
      setItems((current) =>
        current.map((item) =>
          ids.includes(item.id) ? { ...item, readAt: item.readAt ?? new Date().toISOString() } : item,
        ),
      );
      setUnreadCount(result.unreadCount);
      setError("");
    } catch (reason) {
      setError(errorMessage(reason, t("notifications.readError")));
      void loadNotifications();
    }
  }, [items, loadNotifications, t]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!wrapper.current?.contains(event.target as Node)) void closeAndRead();
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") void closeAndRead();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [closeAndRead, open]);

  async function toggle() {
    if (open) {
      await closeAndRead();
      return;
    }
    setOpen(true);
    await loadNotifications();
  }

  function openNotification(notification: UserNotification) {
    void closeAndRead();
    router.push(notification.postId ? `/community?post=${notification.postId}` : "/community");
  }

  return (
    <div className="notification-wrap" ref={wrapper}>
      <button
        type="button"
        className="notification-trigger"
        aria-label={t("notifications.title")}
        aria-expanded={open}
        title={t("notifications.title")}
        onClick={() => void toggle()}
      >
        <Bell size={19} aria-hidden />
        {unreadCount > 0 ? (
          <span className="notification-badge" aria-label={t("notifications.unread", { count: unreadCount })}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <section className="notification-panel" aria-label={t("notifications.title")}>
          <header className="notification-panel-heading">
            <h2>{t("notifications.title")}</h2>
            <button type="button" aria-label={t("common.close")} onClick={() => void closeAndRead()}>
              <X size={18} aria-hidden />
            </button>
          </header>
          {error ? <p className="notification-error" role="alert">{error}</p> : null}
          {loading && !items.length ? (
            <p className="notification-state">{t("common.loading")}</p>
          ) : items.length ? (
            <ul className="notification-list">
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className={item.readAt ? "notification-item" : "notification-item unread"}
                    onClick={() => openNotification(item)}
                  >
                    <span className="notification-item-text">{notificationMessage(item, t)}</span>
                    <time dateTime={item.createdAt}>
                      {formatRelativeTime(item.createdAt, intlLocale) ?? t("community.post.justNow")}
                    </time>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="notification-state">{t("notifications.empty")}</p>
          )}
          {items.length ? (
            <p className="notification-close-hint">{t("notifications.closeHint")}</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
