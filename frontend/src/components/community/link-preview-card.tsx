import { ExternalLink, X } from "lucide-react";
import type { LinkPreview } from "@/lib/api/community";

type Props = {
  preview: LinkPreview;
  /** When provided, shows a dismiss button (composer only). */
  onRemove?: () => void;
  removeLabel?: string;
};

/** Thumbnail card for a URL found in a post. */
export function LinkPreviewCard({ preview, onRemove, removeLabel }: Props) {
  let host = preview.site ?? preview.url;
  try {
    host = preview.site ?? new URL(preview.url).hostname;
  } catch {
    // Keep the raw URL if it cannot be parsed.
  }

  return (
    <div className="link-preview">
      <a href={preview.url} target="_blank" rel="noopener noreferrer nofollow ugc" className="link-preview-link">
        {preview.image ? (
          // Remote thumbnails are arbitrary hosts, so next/image optimization is not used.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.image}
            alt=""
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="link-preview-image"
          />
        ) : null}
        <span className="link-preview-body">
          <span className="link-preview-site">
            <ExternalLink size={14} aria-hidden /> {host}
          </span>
          {preview.title ? <strong>{preview.title}</strong> : null}
          {preview.description ? <span className="link-preview-desc">{preview.description}</span> : null}
        </span>
      </a>
      {onRemove ? (
        <button type="button" className="link-preview-remove" onClick={onRemove} aria-label={removeLabel} title={removeLabel}>
          <X size={16} aria-hidden />
        </button>
      ) : null}
    </div>
  );
}
