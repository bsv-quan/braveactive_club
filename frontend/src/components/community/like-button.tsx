import { Heart } from "lucide-react";

type Props = {
  liked: boolean;
  count: number;
  label: string;
  countAriaLabel?: string;
  disabled?: boolean;
  onToggle: () => void;
  onShowLikers?: () => void;
};

export function LikeButton({
  liked,
  count,
  label,
  countAriaLabel,
  disabled,
  onToggle,
  onShowLikers,
}: Props) {
  return (
    <div className={liked ? "post-like-group liked" : "post-like-group"}>
      <button
        type="button"
        className={liked ? "post-action liked" : "post-action"}
        aria-pressed={liked}
        disabled={disabled}
        onClick={onToggle}
      >
        <Heart
          className="post-like-icon"
          size={18}
          aria-hidden="true"
          fill={liked ? "currentColor" : "none"}
        />
        <span>{label}</span>
      </button>
      {count > 0 ? (
        onShowLikers ? (
          <button
            type="button"
            className="post-action-count post-like-count-btn"
            aria-haspopup="dialog"
            aria-label={countAriaLabel ?? String(count)}
            title={countAriaLabel}
            onClick={onShowLikers}
          >
            {count}
          </button>
        ) : (
          <span className="post-action-count">{count}</span>
        )
      ) : null}
    </div>
  );
}
