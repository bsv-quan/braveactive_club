"use client";

import { ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/form-controls";
import { UserAvatar } from "@/components/ui/user-avatar";
import { errorMessage } from "@/lib/api/client";
import { communityApi, type CommunityPost, type LinkPreview } from "@/lib/api/community";
import { findFirstUrl } from "@/lib/format";
import { useI18n } from "@/i18n/i18n-provider";
import { LinkPreviewCard } from "./link-preview-card";

const MAX_IMAGE_MB = 5;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PREVIEW_DEBOUNCE_MS = 700;

type Props = {
  displayName: string;
  avatarUrl: string | null;
  onPosted: (post: CommunityPost) => void;
};

/** Create-post box: text, one optional image, and an automatic link preview. */
export function PostComposer({ displayName, avatarUrl, onPosted }: Props) {
  const { t } = useI18n();
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // URLs whose preview the user removed; they are not fetched again.
  const [dismissedUrl, setDismissedUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  // The detected URL the current preview (or failed lookup) belongs to.
  const previewForRef = useRef<string | null>(null);

  const detectedUrl = findFirstUrl(content);

  // Debounced preview lookup. An attached image disables the feature entirely.
  useEffect(() => {
    if (image || !detectedUrl || detectedUrl === dismissedUrl) {
      previewForRef.current = null;
      setPreview(null);
      setPreviewLoading(false);
      return;
    }
    if (previewForRef.current === detectedUrl) return;

    let cancelled = false;
    setPreviewLoading(true);
    const timer = setTimeout(() => {
      communityApi
        .linkPreview(detectedUrl)
        .then((result) => {
          if (cancelled) return;
          previewForRef.current = detectedUrl;
          setPreview(result);
        })
        .catch(() => {
          if (cancelled) return;
          previewForRef.current = detectedUrl;
          setPreview(null);
        })
        .finally(() => !cancelled && setPreviewLoading(false));
    }, PREVIEW_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [detectedUrl, image, dismissedUrl]);

  // Release the object URL used for the local image thumbnail.
  useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }, [imageUrl]);

  function pickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!ALLOWED_TYPES.includes(file.type)) return setError(t("community.composer.imageType"));
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) {
      return setError(t("community.composer.imageSize", { size: MAX_IMAGE_MB }));
    }
    setError("");
    setImage(file);
    setImageUrl(URL.createObjectURL(file));
  }

  function removeImage() {
    setImage(null);
    setImageUrl(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim() && !image) return setError(t("community.composer.empty"));
    setSubmitting(true);
    setError("");
    try {
      const post = await communityApi.createPost({
        content: content.trim(),
        image,
        linkUrl: !image && detectedUrl && detectedUrl !== dismissedUrl ? detectedUrl : null,
        skipPreview: Boolean(image) || (detectedUrl !== null && detectedUrl === dismissedUrl),
      });
      onPosted(post);
      setContent("");
      removeImage();
      setPreview(null);
      previewForRef.current = null;
      setDismissedUrl(null);
    } catch (err) {
      setError(errorMessage(err, t("common.genericError")));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="composer card" onSubmit={handleSubmit}>
      <div className="composer-row">
        <UserAvatar name={displayName} avatarUrl={avatarUrl} />
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={t("community.composer.placeholder", { name: displayName })}
          maxLength={2000}
          rows={3}
          aria-label={t("community.composer.placeholder", { name: displayName })}
        />
      </div>

      {imageUrl ? (
        <div className="composer-image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="" />
          <button type="button" onClick={removeImage} aria-label={t("community.composer.removeImage")} title={t("community.composer.removeImage")}>
            <X size={16} aria-hidden />
          </button>
        </div>
      ) : previewLoading ? (
        <p className="muted">{t("community.preview.loading")}</p>
      ) : preview ? (
        <LinkPreviewCard
          preview={preview}
          removeLabel={t("community.preview.remove")}
          onRemove={() => {
            setDismissedUrl(detectedUrl);
            setPreview(null);
          }}
        />
      ) : null}

      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="composer-actions">
        <input ref={fileInput} type="file" accept={ALLOWED_TYPES.join(",")} hidden onChange={pickImage} />
        <Button variant="ghost" icon={ImagePlus} onClick={() => fileInput.current?.click()}>
          {t("community.composer.addImage")}
        </Button>
        <Button type="submit" loading={submitting}>
          {submitting ? t("community.composer.posting") : t("community.composer.post")}
        </Button>
      </div>
    </form>
  );
}
