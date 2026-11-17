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
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const PREVIEW_DEBOUNCE_MS = 700;
type ComposerImage = { file: File; url: string };

type Props = {
  displayName: string;
  avatarUrl: string | null;
  onPosted: (post: CommunityPost) => void;
};

/** Create-post box: text, one optional image, and an automatic link preview. */
export function PostComposer({ displayName, avatarUrl, onPosted }: Props) {
  const { t } = useI18n();
  const [content, setContent] = useState("");
  const [images, setImages] = useState<ComposerImage[]>([]);
  const [imageOrientation, setImageOrientation] = useState<"landscape" | "portrait">("landscape");
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // URLs whose preview the user removed; they are not fetched again.
  const [dismissedUrl, setDismissedUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const objectUrls = useRef(new Set<string>());
  // The detected URL the current preview (or failed lookup) belongs to.
  const previewForRef = useRef<string | null>(null);

  const detectedUrl = findFirstUrl(content);

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
    try {
      const post = await communityApi.createPost({
        content: content.trim(),
        images: images.map(({ file }) => file),
        linkUrl: !images.length && detectedUrl && detectedUrl !== dismissedUrl ? detectedUrl : null,
        skipPreview: Boolean(images.length) || (detectedUrl !== null && detectedUrl === dismissedUrl),
      });
      onPosted(post);
      setContent("");
      clearImages();
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
        <EmojiTextField
          value={content}
          onChange={setContent}
          placeholder={t("community.composer.placeholder", { name: displayName })}
          maxLength={2000}
          multiline
          rows={3}
          aria-label={t("community.composer.placeholder", { name: displayName })}
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
                <X size={16} aria-hidden />
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

      <div className="composer-actions">
        <input ref={fileInput} type="file" accept={ALLOWED_TYPES.join(",")} multiple hidden onChange={pickImage} />
        <Button variant="ghost" icon={ImagePlus} disabled={images.length >= MAX_IMAGES} onClick={() => fileInput.current?.click()}>
          {t("community.composer.addImage")}
        </Button>
        <Button type="submit" loading={submitting}>
          {submitting ? t("community.composer.posting") : t("community.composer.post")}
        </Button>
      </div>
    </form>
  );
}
