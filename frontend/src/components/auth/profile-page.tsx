"use client";

import Cropper from "react-easy-crop";
import Link from "next/link";
import { ImagePlus, KeyRound, Mail, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/confirm-dialog";
import { Alert } from "@/components/ui/form-controls";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useI18n } from "@/i18n/i18n-provider";
import { cropImageToJpeg, type CropArea } from "@/lib/crop-image";
import { ApiError, errorMessage } from "@/lib/api/client";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ProfilePage() {
  const { t } = useI18n();
  const { confirm } = useDialog();
  const { user, loading, updateProfile, uploadAvatar, removeAvatar } = useAuth();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=%2Fprofile");
  }, [loading, router, user]);

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
  }, [user?.displayName]);

  useEffect(() => () => {
    if (cropImage) URL.revokeObjectURL(cropImage);
  }, [cropImage]);

  function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) {
      setError(t("auth.profile.imageType"));
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setError(t("auth.profile.imageSize"));
      return;
    }
    setError("");
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCropImage(URL.createObjectURL(file));
  }

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await updateProfile(displayName.trim());
      setSuccess(true);
    } catch (reason) {
      setError(errorMessage(reason, t("auth.profile.saveError")));
    } finally {
      setSaving(false);
    }
  }

  async function saveCroppedAvatar() {
    if (!cropImage || !cropArea) return;
    setSaving(true);
    setError("");
    try {
      const blob = await cropImageToJpeg(cropImage, cropArea);
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      await uploadAvatar(file);
      setCropImage(null);
      setSuccess(true);
    } catch (reason) {
      setError(
        reason instanceof ApiError
          ? errorMessage(reason, t("auth.profile.uploadError"))
          : t("auth.profile.uploadError"),
      );
    } finally {
      setSaving(false);
    }
  }

  async function clearAvatar() {
    if (
      !(await confirm({
        title: t("auth.profile.removePhoto"),
        message: t("auth.profile.removePhotoConfirm"),
        confirmLabel: t("common.delete"),
        tone: "danger",
      }))
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      await removeAvatar();
    } catch (reason) {
      setError(errorMessage(reason, t("auth.profile.uploadError")));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) return <AppShell><section className="profile-page" /></AppShell>;

  return (
    <AppShell>
      <section className="profile-page profile-page-v2">
        <header className="profile-masthead">
          <span className="community-masthead-kicker">{t("auth.profile.kicker")}</span>
          <h1>{t("auth.profile.title")}</h1>
          <p>{t("auth.profile.subtitle")}</p>
        </header>

        <div className="profile-grid">
          <aside className="profile-identity-card">
            <div className="profile-avatar-ring">
              <UserAvatar name={user.displayName} avatarUrl={user.avatarUrl} size={112} />
            </div>
            <div className="profile-identity-copy">
              <h2>{user.displayName}</h2>
              <span className="profile-identity-email">
                <Mail size={13} aria-hidden="true" /> {user.email}
              </span>
              <span className={`admin-role-badge${user.role === "admin" ? " is-admin" : ""}`}>
                <ShieldCheck size={12} aria-hidden="true" />{" "}
                {user.role === "admin" ? t("admin.adminRole") : t("admin.member")}
              </span>
            </div>
            <div className="profile-avatar-actions">
              <Button variant="secondary" icon={ImagePlus} onClick={() => fileInput.current?.click()}>
                {t("auth.profile.changePhoto")}
              </Button>
              {user.avatarUrl ? (
                <Button variant="ghost" icon={Trash2} onClick={() => void clearAvatar()} disabled={saving}>
                  {t("auth.profile.removePhoto")}
                </Button>
              ) : null}
            </div>
            <p className="profile-avatar-hint">{t("auth.profile.cropHelp")}</p>
            <input ref={fileInput} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={chooseFile} />
            <div className="profile-security-link">
              <Link className="ui-button ui-button-ghost ui-button-sm" href="/change-password">
                <KeyRound size={15} aria-hidden="true" /> {t("auth.change.title")}
              </Link>
            </div>
          </aside>

          <form className="profile-settings-card profile-form" onSubmit={(event) => void saveProfile(event)}>
            <div className="profile-field">
              <label htmlFor="profile-display-name">{t("auth.profile.displayName")}</label>
              <input
                id="profile-display-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                minLength={2}
                maxLength={40}
                required
              />
            </div>
            <div className="profile-field">
              <label htmlFor="profile-email">{t("auth.profile.email")}</label>
              <input id="profile-email" value={user.email} disabled readOnly />
            </div>
            {error ? <Alert tone="error">{error}</Alert> : null}
            {success ? <Alert tone="success">{t("auth.profile.saved")}</Alert> : null}
            <div className="profile-form-footer">
              <Button type="submit" icon={Save} loading={saving} disabled={!displayName.trim()}>
                {t("auth.profile.save")}
              </Button>
            </div>
          </form>
        </div>

        {cropImage ? (
          <div className="modal-backdrop" role="presentation">
            <section className="avatar-crop-modal" role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title">
              <header>
                <div>
                  <h2 id="avatar-crop-title">{t("auth.profile.cropTitle")}</h2>
                  <p>{t("auth.profile.cropHelp")}</p>
                </div>
                <button type="button" className="modal-close" aria-label={t("common.close")} onClick={() => setCropImage(null)}>
                  <X size={18} aria-hidden />
                </button>
              </header>
              <div className="avatar-crop-area">
                <Cropper
                  image={cropImage}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="rect"
                  showGrid
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_, pixels) => setCropArea(pixels)}
                />
              </div>
              <label className="avatar-zoom-control">
                {t("auth.profile.zoom")}
                <input
                  type="range"
                  min={1}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={(event) => setZoom(Number(event.target.value))}
                />
              </label>
              <div className="avatar-crop-actions">
                <Button variant="ghost" onClick={() => setCropImage(null)}>{t("common.cancel")}</Button>
                <Button icon={Save} loading={saving} onClick={() => void saveCroppedAvatar()}>
                  {t("auth.profile.applyCrop")}
                </Button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
