"use client";

import { CalendarDays, Home, LogIn, LogOut, ShieldCheck, UserPlus, Users, UserRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { UserAvatar } from "@/components/ui/user-avatar";
import { NotificationBell } from "@/components/layout/notification-bell";
import { useI18n } from "@/i18n/i18n-provider";
import { useFeedEvents } from "@/lib/use-feed-events";

export type NavPage = "overview" | "activities" | "community" | "admin";

const NAV_ITEMS = [
  { page: "overview", href: "/", label: "nav.overview", icon: Home },
  { page: "activities", href: "/activities", label: "nav.activities", icon: CalendarDays },
  { page: "community", href: "/community", label: "nav.community", icon: Users },
] as const;

/** Top bar: logo, main navigation, language switcher and the login / user menu. */
export function ClubHeader({ currentPage }: { currentPage?: NavPage }) {
  const { user, loading, logout } = useAuth();
  const { t } = useI18n();
  const [unreadPosts, setUnreadPosts] = useState(0);
  const unreadRef = useRef(0);
  const storageKey = user ? `ba_unread_posts:${user.id}` : null;

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
      <nav className="main-nav" aria-label={t("nav.ariaLabel")}>
        {NAV_ITEMS.map(({ page, href, label, icon: Icon }) => (
          <Link
            key={page}
            className={currentPage === page ? "nav-link active" : "nav-link"}
            href={href}
            onClick={page === "community" ? clearUnreadPosts : undefined}
          >
            <Icon size={18} aria-hidden />
            <span>{t(label)}</span>
            {page === "community" && user && unreadPosts > 0 ? (
              <span className="nav-badge" aria-label={t("community.badge", { count: unreadPosts })}>
                {unreadPosts > 99 ? "99+" : unreadPosts}
              </span>
            ) : null}
          </Link>
        ))}
        {user?.role === "admin" ? (
          <Link className={currentPage === "admin" ? "nav-link active" : "nav-link"} href="/admin/posts">
            <ShieldCheck size={18} aria-hidden />
            <span>{t("nav.adminPosts")}</span>
          </Link>
        ) : null}
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
            <Link
              className="profile-icon-link"
              href="/profile"
              aria-label={t("auth.profile.title")}
              title={t("auth.profile.title")}
            >
              <UserRound size={17} aria-hidden />
            </Link>
            <button type="button" className="ui-button ui-button-ghost ui-button-sm" onClick={() => void logout()}>
              <LogOut size={16} aria-hidden /> {t("auth.logout")}
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
