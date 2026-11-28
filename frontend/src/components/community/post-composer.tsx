"use client";

import { ImagePlus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/form-controls";
import { UserAvatar } from "@/components/ui/user-avatar";
import { EmojiTextField } from "@/components/ui/emoji-text-field";
import { errorMessage } from "@/lib/api/client";
import { communityApi, type CommunityPost, type LinkPreview } from "@/lib/api/community";
import { findFirstUrl } from "@/lib/format";
import { useI18n } from "@/i18n/i18n-provider";
import { LinkPreviewCard } from "./link-preview-card";

const MAX_IMAGE_MB = 5;
const MAX_IMAGES = 4;
const MAX_CHARS = 2000;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PREVIEW_DEBOUNCE_MS = 700;
type ComposerImage = { file: File; url: string };

type Props = {
  displayName: string;
  avatarUrl: string | null;
  onPosted: (post: CommunityPost) => void;
};

/** Single-line note bar at rest so news stories stay above the fold; expands on demand. */
export function PostComposer({ displayName, avatarUrl, onPosted }: Props) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [content, setContent] = useState("");
  const [images, setImages] = useState<ComposerImage[]>([]);
  const [imageOrientation, setImageOrientation] = useState<"landscape" | "portrait">("landscape");
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // URLs whose preview the user removed; they are not fetched again.
  const [dismissedUrl, setDismissedUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const objectUrls = useRef(new Set<string>());
  // The detected URL the current preview (or failed lookup) belongs to.
  const previewForRef = useRef<string | null>(null);

  const detectedUrl = findFirstUrl(content);
  const isOpen = expanded || Boolean(content.trim()) || images.length > 0 || Boolean(error);

  // Debounced preview lookup. Attached images disable the feature entirely.
  useEffect(() => {
    if (images.length || !detectedUrl || detectedUrl === dismissedUrl) {
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
  }, [detectedUrl, images.length, dismissedUrl]);

  useEffect(() => () => {
    objectUrls.current.forEach((url) => URL.revokeObjectURL(url));
    objectUrls.current.clear();
  }, []);

  function pickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;
    setExpanded(true);
    if (images.length + files.length > MAX_IMAGES) {
      return setError(t("community.composer.imageLimit", { max: MAX_IMAGES }));
    }
    const invalidType = files.find((file) => !ALLOWED_TYPES.includes(file.type));
    if (invalidType) return setError(t("community.composer.imageType"));
    const oversized = files.find((file) => file.size > MAX_IMAGE_MB * 1024 * 1024);
    if (oversized) return setError(t("community.composer.imageSize", { size: MAX_IMAGE_MB }));
    setError("");
    setImages((current) => [
      ...current,
      ...files.map((file) => {
        const url = URL.createObjectURL(file);
        objectUrls.current.add(url);
        return { file, url };
      }),
    ]);
  }

  function removeImage(index: number) {
    setImages((current) => {
      const removed = current[index];
      if (removed) {
        URL.revokeObjectURL(removed.url);
        objectUrls.current.delete(removed.url);
      }
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  function clearImages() {
    images.forEach(({ url }) => {
      URL.revokeObjectURL(url);
      objectUrls.current.delete(url);
    });
    setImages([]);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!content.trim() && !images.length) return setError(t("community.composer.empty"));
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      const post = await communityApi.createPost({
        content: content.trim(),
        images: images.map(({ file }) => file),
        linkUrl: !images.length && detectedUrl && detectedUrl !== dismissedUrl ? detectedUrl : null,
        skipPreview: Boolean(images.length) || (detectedUrl !== null && detectedUrl === dismissedUrl),
      });
      onPosted(post);
      if (!post.approved) setNotice(t("community.composer.pendingApproval"));
      setContent("");
      clearImages();
      setPreview(null);
      previewForRef.current = null;
      setDismissedUrl(null);
      setExpanded(false);
    } catch (err) {
      setError(errorMessage(err, t("common.genericError")));
    } finally {
      setSubmitting(false);
    }
  }

  const placeholderText = t("community.composer.placeholder", { name: displayName });

  return (
    <form className={`composer${isOpen ? " card is-expanded" : " is-compact"}`} onSubmit={handleSubmit}>
      <input ref={fileInput} type="file" accept={ALLOWED_TYPES.join(",")} multiple hidden onChange={pickImage} />
      {isOpen ? (
        <>
          <div className="composer-row">
            <UserAvatar name={displayName} avatarUrl={avatarUrl} size={36} />
            <EmojiTextField
              value={content}
              onChange={setContent}
              placeholder={placeholderText}
              maxLength={MAX_CHARS}
              multiline
              rows={3}
              autoFocus={expanded}
              autoResize
              aria-label={placeholderText}
            />
          </div>

          {images.length ? (
            <div
              className={`composer-image-grid composer-image-count-${images.length}`}
              data-orientation={imageOrientation}
            >
              {images.map((image, index) => (
                <div className="composer-image" key={image.url}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={image.url}
                    alt=""
                    onLoad={(event) => {
                      if (index === 0) {
                        const selectedImage = event.currentTarget;
                        setImageOrientation(
                          selectedImage.naturalHeight > selectedImage.naturalWidth ? "portrait" : "landscape",
                        );
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    aria-label={`${t("community.composer.removeImage")} ${index + 1}`}
                    title={t("community.composer.removeImage")}
                  >
                    <X size={16} aria-hidden="true" />
                  </button>
                </div>
              ))}
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
          {notice ? <Alert tone="success">{notice}</Alert> : null}

          <div className="composer-actions">
            <Button
              variant="ghost"
              size="sm"
              icon={ImagePlus}
              disabled={images.length >= MAX_IMAGES}
              onClick={() => fileInput.current?.click()}
            >
              {t("community.composer.addImage")}
            </Button>
            <div className="composer-actions-end">
              {content.length > 0 ? (
                <span
                  className={`composer-char-count${content.length > MAX_CHARS - 120 ? " is-near-limit" : ""}`}
                  aria-hidden="true"
                >
                  {t("community.composer.charCount", { count: content.length, max: MAX_CHARS })}
                </span>
              ) : null}
              {!content.trim() && !images.length ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setError("");
                    setExpanded(false);
                    requestAnimationFrame(() => triggerRef.current?.focus());
                  }}
                >
                  {t("community.composer.collapse")}
                </Button>
              ) : null}
              <Button type="submit" size="sm" loading={submitting}>
                {submitting ? t("community.composer.posting") : t("community.composer.post")}
              </Button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="composer-compact-row">
            <UserAvatar name={displayName} avatarUrl={avatarUrl} size={34} />
            <button
              ref={triggerRef}
              type="button"
              className="composer-trigger"
              onClick={() => {
                setNotice("");
                setExpanded(true);
              }}
            >
              <span>{placeholderText}</span>
            </button>
            <Button
              variant="ghost"
              size="sm"
              icon={ImagePlus}
              onClick={() => {
                setNotice("");
                fileInput.current?.click();
              }}
            >
              {t("community.composer.addImage")}
            </Button>
          </div>
          {notice ? <Alert tone="success">{notice}</Alert> : null}
        </>
      )}
    </form>
  );
}
