import { Heart } from "lucide-react";

type Props = {
  liked: boolean;
  count: number;
  label: string;
  disabled?: boolean;
  onToggle: () => void;
};

export function LikeButton({ liked, count, label, disabled, onToggle }: Props) {
  return (
    <button
      type="button"
      className={liked ? "post-action liked" : "post-action"}
      aria-pressed={liked}
      disabled={disabled}
      onClick={onToggle}
    >
      <Heart size={18} aria-hidden fill={liked ? "currentColor" : "none"} />
      <span>{label}</span>
      {count > 0 ? <span className="post-action-count">{count}</span> : null}
    </button>
  );
}
