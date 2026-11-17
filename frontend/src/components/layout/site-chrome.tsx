"use client";

import { CalendarDays, LogIn, LogOut, Settings, UserPlus, Users } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { UserAvatar } from "@/components/ui/user-avatar";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useI18n } from "@/i18n/i18n-provider";
import { useFeedEvents } from "@/lib/use-feed-events";

export type NavPage = "overview" | "activities" | "community" | "admin";
const COMMUNITY_RELOAD_TO_TOP_KEY = "ba:community-reload-to-top";

/** Top bar: logo, compact community links, language switcher and the account menu. */
export function ClubHeader({ currentPage }: { currentPage?: NavPage }) {
  const { user, loading, logout } = useAuth();
  const { t } = useI18n();
  const [unreadPosts, setUnreadPosts] = useState(0);
  const unreadRef = useRef(0);
  const storageKey = user ? `ba_unread_posts:${user.id}` : null;

  useEffect(() => {
    if (currentPage !== "community") return;
    try {
      if (sessionStorage.getItem(COMMUNITY_RELOAD_TO_TOP_KEY) !== "1") return;
      sessionStorage.removeItem(COMMUNITY_RELOAD_TO_TOP_KEY);
      window.scrollTo({ top: 0, behavior: "auto" });
      window.history.scrollRestoration = "auto";
    } catch {
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [currentPage]);

  useEffect(() => {
    if (!storageKey) {
      unreadRef.current = 0;
      setUnreadPosts(0);
      return;
    }
    if (currentPage === "community") {
      try {
        localStorage.setItem(storageKey, "0");
      } catch {
        // The badge remains available in memory if browser storage is disabled.
      }
      unreadRef.current = 0;
      setUnreadPosts(0);
      return;
    }
    try {
      const stored = Number(localStorage.getItem(storageKey) ?? "0");
      unreadRef.current = Number.isSafeInteger(stored) && stored > 0 ? stored : 0;
    } catch {
      unreadRef.current = 0;
    }
    setUnreadPosts(unreadRef.current);
  }, [storageKey, currentPage]);

  const handleFeedEvent = useCallback(
    (event: import("@/lib/api/community").FeedEvent) => {
      if (event.type !== "post.created" || event.post.author.id === user?.id || currentPage === "community" || !storageKey) {
        return;
      }
      unreadRef.current = Math.min(unreadRef.current + 1, 99);
      setUnreadPosts(unreadRef.current);
      try {
        localStorage.setItem(storageKey, String(unreadRef.current));
      } catch {
        // The badge still updates for this page view.
      }
    },
    [currentPage, storageKey, user?.id],
  );
  useFeedEvents(handleFeedEvent, undefined, Boolean(user && !loading));

  function clearUnreadPosts() {
    unreadRef.current = 0;
    setUnreadPosts(0);
    try {
      if (storageKey) localStorage.setItem(storageKey, "0");
    } catch {
      // The visible badge is cleared even when storage is disabled.
    }
  }

  return (
    <header className="topbar">
      <Link className="brand" href="/">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo" src="/logos/braveactive.png" alt="Brave Active" />
      </Link>
      <nav className="community-hub-switcher" aria-label={t("nav.ariaLabel")}>
        <Link
          className={currentPage === "community" ? "community-hub-link active" : "community-hub-link"}
          href="/community"
          aria-current={currentPage === "community" ? "page" : undefined}
          onClick={(event) => {
            clearUnreadPosts();
            if (currentPage === "community") {
              event.preventDefault();
              window.history.scrollRestoration = "manual";
              try {
                sessionStorage.setItem(COMMUNITY_RELOAD_TO_TOP_KEY, "1");
              } catch {
                window.scrollTo({ top: 0, behavior: "auto" });
              }
              window.location.reload();
            }
          }}
        >
          <Users size={16} aria-hidden />
          <span>{t("nav.community")}</span>
          {user && unreadPosts > 0 ? (
            <span className="nav-badge" aria-label={t("community.badge", { count: unreadPosts })}>
              {unreadPosts > 99 ? "99+" : unreadPosts}
            </span>
          ) : null}
        </Link>
        <Link
          className={currentPage === "activities" ? "community-hub-link active" : "community-hub-link"}
          href="/activities"
          aria-current={currentPage === "activities" ? "page" : undefined}
        >
          <CalendarDays size={16} aria-hidden />
          <span>{t("nav.activities")}</span>
        </Link>
      </nav>
      <div className="auth-menu">
        <LanguageSwitcher />
        {loading ? null : user ? (
          <>
            {!user.mustChangePassword ? <NotificationBell key={user.id} userId={user.id} /> : null}
            <span className="auth-user">
              <UserAvatar name={user.displayName} avatarUrl={user.avatarUrl} size={32} />
              <Link className="auth-name" href="/profile">{user.displayName}</Link>
            </span>
            {user.role === "admin" ? (
              <Link
                className="admin-header-link"
                href="/admin"
                aria-label={t("nav.adminPosts")}
                title={t("nav.adminPosts")}
                aria-current={currentPage === "admin" ? "page" : undefined}
              >
                <Settings size={19} aria-hidden />
              </Link>
            ) : null}
            <button
              type="button"
              className="ui-icon-button"
              aria-label={t("auth.logout")}
              title={t("auth.logout")}
              onClick={() => void logout()}
            >
              <LogOut size={18} aria-hidden />
            </button>
          </>
        ) : (
          <>
            <Link className="ui-button ui-button-ghost ui-button-sm" href="/login">
              <LogIn size={16} aria-hidden /> {t("auth.login.submit")}
            </Link>
            <Link className="ui-button ui-button-primary ui-button-sm" href="/register">
              <UserPlus size={16} aria-hidden /> {t("auth.register.submit")}
            </Link>
          </>
        )}
      </div>
    </header>
  );
}

export function ClubFooter() {
  const { t } = useI18n();
  return (
    <footer className="footer">
      <Link className="brand footer-brand" href="/">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="brand-logo footer-logo" src="/logos/bravesoft.png" alt="BraveSoft" />
      </Link>
      <span>{t("footer.tagline")}</span>
      <span>© 2026 Brave Active Club</span>
    </footer>
  );
}
