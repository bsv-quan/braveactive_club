"use client";

import { Heart, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useI18n } from "@/i18n/i18n-provider";
import { communityApi, type PostLiker } from "@/lib/api/community";
import { formatRelativeTime } from "@/lib/format";

type PostLikersDialogProps = {
  postId: string;
  likeCount: number;
  onClose: () => void;
};

/** Native modal dialog listing members who liked a community post. */
export function PostLikersDialog({ postId, likeCount, onClose }: PostLikersDialogProps) {
  const { t, intlLocale } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [likers, setLikers] = useState<PostLiker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();

    if (!("closedBy" in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const isOutside = (event: PointerEvent) => {
        const rect = dialog.getBoundingClientRect();
        return (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        );
      };
      const handlePointerDown = (event: PointerEvent) => {
        pressedOutside = isOutside(event);
      };
      const handlePointerUp = (event: PointerEvent) => {
        if (pressedOutside && isOutside(event)) dialog.close();
      };
      dialog.addEventListener("pointerdown", handlePointerDown);
      dialog.addEventListener("pointerup", handlePointerUp);
      return () => {
        dialog.removeEventListener("pointerdown", handlePointerDown);
        dialog.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    communityApi
      .listPostLikes(postId)
      .then((list) => {
        if (active) setLikers(list);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [postId]);

  return (
    <dialog
      ref={dialogRef}
      className="post-likers-dialog"
      {...({ closedby: "any" } as Record<string, string>)}
      aria-labelledby="post-likers-dialog-title"
      onClose={onClose}
    >
      <header className="post-likers-header">
        <div className="post-likers-title-wrap">
          <span className="post-likers-heart-badge" aria-hidden="true">
            <Heart size={16} fill="currentColor" />
          </span>
          <div>
            <h1 id="post-likers-dialog-title">{t("community.post.likesDialogTitle")}</h1>
            <span>{t("community.post.likes", { count: likers.length || likeCount })}</span>
          </div>
        </div>
        <button
          type="button"
          className="ui-icon-button"
          aria-label={t("common.close")}
          onClick={() => dialogRef.current?.close()}
        >
          <X size={19} aria-hidden="true" />
        </button>
      </header>

      <div className="post-likers-body">
        {loading ? (
          <p className="post-likers-state">
            <Loader2 size={16} className="ui-spin" aria-hidden="true" /> {t("common.loading")}
          </p>
        ) : error ? (
          <p className="post-likers-state is-error" role="alert">
            {t("community.post.likesLoadError")}
          </p>
        ) : likers.length === 0 ? (
          <p className="post-likers-state">{t("community.post.likesEmpty")}</p>
        ) : (
          <ul className="post-likers-list">
            {likers.map((liker) => (
              <li key={liker.id} className="post-liker-row">
                <UserAvatar name={liker.displayName} avatarUrl={liker.avatarUrl} size={36} />
                <div className="post-liker-copy">
                  <strong>{liker.displayName}</strong>
                  <time dateTime={liker.likedAt}>
                    {formatRelativeTime(liker.likedAt, intlLocale) ?? t("community.post.justNow")}
                  </time>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </dialog>
  );
}
