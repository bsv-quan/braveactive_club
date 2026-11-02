import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/i18n/i18n-provider";

const AVATAR_COLORS = ["#f4c6a8", "#cfe3b6", "#c9c6e8", "#f2dc9b", "#b7d7e8", "#f0b9c5"];

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

/** Deterministic colour per name so the same user always looks the same. */
function colorOf(name: string) {
  let hash = 0;
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function PresenceIndicator({ online }: { online: boolean }) {
  const { t } = useI18n();
  return (
    <span
      className={online ? "presence-indicator online" : "presence-indicator offline"}
      role="img"
      aria-label={t(online ? "presence.online" : "presence.offline")}
      title={t(online ? "presence.online" : "presence.offline")}
    />
  );
}

export function UserAvatar({
  name,
  size = 40,
  avatarUrl,
  online,
}: {
  name: string;
  size?: number;
  avatarUrl?: string | null;
  online?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const { t } = useI18n();
  useEffect(() => {
    if (isOpen) closeButton.current?.focus();
  }, [isOpen]);
  if (avatarUrl) {
    return (
      <>
        <span className="ui-avatar-wrap" style={{ width: size, height: size }}>
          <button
            type="button"
            className="ui-avatar-image-button"
            style={{ width: size, height: size }}
            aria-label={t("auth.profile.viewPhoto", { name })}
            onClick={() => setIsOpen(true)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="ui-avatar-image" src={avatarUrl} alt="" />
          </button>
          {online !== undefined ? <PresenceIndicator online={online} /> : null}
        </span>
        {isOpen ? (
          <div
            className="avatar-viewer-backdrop"
            role="dialog"
            aria-modal="true"
            aria-label={t("auth.profile.viewPhoto", { name })}
            onClick={() => setIsOpen(false)}
          >
            <button
              ref={closeButton}
              type="button"
              className="avatar-viewer-close"
              onClick={() => setIsOpen(false)}
              onKeyDown={(event) => {
                if (event.key === "Escape") setIsOpen(false);
              }}
            >
              {t("auth.profile.closePhoto")}
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="avatar-viewer-image" src={avatarUrl} alt={name} onClick={(event) => event.stopPropagation()} />
          </div>
        ) : null}
      </>
    );
  }

  return (
    <span className="ui-avatar-wrap" style={{ width: size, height: size }}>
      <span
        className="ui-avatar"
        style={{ width: size, height: size, background: colorOf(name), fontSize: size * 0.38 }}
        aria-hidden
      >
        {initialsOf(name)}
      </span>
      {online !== undefined ? <PresenceIndicator online={online} /> : null}
    </span>
  );
}
