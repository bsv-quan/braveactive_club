"use client";

import Cropper from "react-easy-crop";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Camera,
  CheckCircle2,
  Crown,
  Flame,
  Gamepad2,
  ImagePlus,
  KeyRound,
  Lock,
  Mail,
  Save,
  ShieldCheck,
  Sparkles,
  Trash2,
  Trophy,
  UserRoundStar,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-provider";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/confirm-dialog";
import { Alert } from "@/components/ui/form-controls";
import { UserAvatar } from "@/components/ui/user-avatar";
import { useI18n } from "@/i18n/i18n-provider";
import { ApiError, errorMessage } from "@/lib/api/client";
import { communityApi, type GameAchievements } from "@/lib/api/community";
import { cropImageToJpeg, type CropArea } from "@/lib/crop-image";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function ProfilePage() {
  const { t } = useI18n();
  const { confirm } = useDialog();
  const { user, loading, updateProfile, uploadAvatar, removeAvatar } = useAuth();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const cropDialogRef = useRef<HTMLDialogElement>(null);

  const [displayName, setDisplayName] = useState(user?.displayName ?? "");
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropArea, setCropArea] = useState<CropArea | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [achievements, setAchievements] = useState<GameAchievements | null>(null);

  useEffect(() => {
    if (!loading && !user) router.replace("/login?next=%2Fprofile");
  }, [loading, router, user]);

  useEffect(() => {
    setDisplayName(user?.displayName ?? "");
  }, [user?.displayName]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    communityApi
      .getGameAchievements()
      .then((res) => {
        if (active) setAchievements(res);
      })
      .catch(() => {
        if (active) setAchievements(null);
      });
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    return () => {
      if (cropImage) URL.revokeObjectURL(cropImage);
    };
  }, [cropImage]);

  useEffect(() => {
    const dialog = cropDialogRef.current;
    if (!cropImage || !dialog) return;
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
    setSuccess(false);
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
      cropDialogRef.current?.close();
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
      setSuccess(true);
    } catch (reason) {
      setError(errorMessage(reason, t("auth.profile.uploadError")));
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) return <AppShell><section className="profile-page" /></AppShell>;

  const trimmedName = displayName.trim();
  const hasUnsavedChanges = trimmedName.length >= 2 && trimmedName !== user.displayName;
  const me = achievements?.me ?? null;
  const unlockedBadges = (me?.badges ?? []).filter((b) => b.unlocked);

  return (
    <AppShell>
      <section className="profile-page profile-page-v3">
        {/* Editorial Folio Masthead */}
        <header className="editorial-folio-masthead profile-folio-masthead">
          <div className="editorial-folio-top">
            <div className="community-dateline">
              <span className="community-edition-tag">{t("auth.profile.kicker")}</span>
              <span className={`admin-role-badge${user.role === "admin" ? " is-admin" : ""}`}>
                <ShieldCheck size={12} aria-hidden="true" />{" "}
                {user.role === "admin" ? t("admin.adminRole") : t("admin.member")}
              </span>
            </div>
            <Link className="event-detail-back" href="/community">
              <ArrowLeft size={14} aria-hidden="true" /> {t("auth.profile.backToCommunity")}
            </Link>
          </div>
          <div className="editorial-folio-main">
            <div className="editorial-folio-copy">
              <h1>{t("auth.profile.title")}</h1>
              <p>{t("auth.profile.subtitle")}</p>
            </div>
            {user.role === "admin" ? (
              <Link className="ui-button ui-button-secondary ui-button-sm" href="/admin">
                <UserRoundStar size={15} aria-hidden="true" /> {t("auth.profile.openAdminConsole")}
              </Link>
            ) : null}
          </div>
        </header>

        {/* Member Passport Hero Banner */}
        <div className="profile-passport-banner">
          <div className="profile-passport-identity">
            <div className="profile-avatar-stage">
              <div className="profile-avatar-ring">
                <UserAvatar name={user.displayName} avatarUrl={user.avatarUrl} size={108} />
              </div>
              <button
                type="button"
                className="profile-avatar-camera-btn"
                aria-label={t("auth.profile.changePhoto")}
                title={t("auth.profile.changePhoto")}
                onClick={() => fileInput.current?.click()}
              >
                <Camera size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="profile-passport-meta">
              <div className="profile-passport-name-row">
                <h2>{user.displayName}</h2>
                {me ? (
                  <span className={`arcade-tier-pill tier-${me.tier}`}>
                    <Crown size={12} aria-hidden="true" />
                    {t(`community.games.arcade.tiers.${me.tier}`)}
                  </span>
                ) : null}
              </div>
              <span className="profile-identity-email">
                <Mail size={14} aria-hidden="true" /> {user.email}
              </span>
              <div className="profile-passport-actions">
                <Button variant="secondary" size="sm" icon={ImagePlus} onClick={() => fileInput.current?.click()}>
                  {t("auth.profile.changePhoto")}
                </Button>
                {user.avatarUrl ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={Trash2}
                    onClick={() => void clearAvatar()}
                    disabled={saving}
                  >
                    {t("auth.profile.removePhoto")}
                  </Button>
                ) : null}
              </div>
              <span className="profile-avatar-specs">{t("auth.profile.avatarSpecs")}</span>
            </div>
          </div>

          <div className="profile-passport-stats">
            <div className="profile-stat-pill is-points">
              <Sparkles size={15} aria-hidden="true" />
              <div>
                <span>{t("community.games.arcade.sharedWalletLabel")}</span>
                <strong>{t("community.games.score.points", { score: me?.totalPoints ?? 0 })}</strong>
              </div>
            </div>
            <div className="profile-stat-pill is-streak">
              <Flame size={15} aria-hidden="true" />
              <div>
                <span>{t("community.games.arcade.sharedStreakLabel")}</span>
                <strong>{t("community.games.arcade.daysUnit", { count: me?.streakDays ?? 0 })}</strong>
              </div>
            </div>
            <div className="profile-stat-pill">
              <Trophy size={15} aria-hidden="true" />
              <div>
                <span>{t("community.games.arcade.clubRankLabel")}</span>
                <strong>{me?.rank ? `#${me.rank}` : t("community.games.arcade.unranked")}</strong>
              </div>
            </div>
          </div>
          <input ref={fileInput} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={chooseFile} />
        </div>

        {/* Two-Column Workspace */}
        <div className="profile-workspace-grid">
          {/* Left: Account Info Form */}
          <form className="profile-panel-card profile-form" onSubmit={(event) => void saveProfile(event)}>
            <div className="profile-panel-head">
              <h3>{t("auth.profile.accountInfoTitle")}</h3>
              <p>{t("auth.profile.accountInfoDesc")}</p>
            </div>

            <div className="profile-field">
              <div className="profile-field-label-row">
                <label htmlFor="profile-display-name">{t("auth.profile.displayName")}</label>
                <span className="profile-char-counter">{displayName.length}/40</span>
              </div>
              <input
                id="profile-display-name"
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  setSuccess(false);
                }}
                minLength={2}
                maxLength={40}
                required
              />
            </div>

            <div className="profile-field">
              <label htmlFor="profile-email">{t("auth.profile.email")}</label>
              <div className="profile-readonly-input">
                <input id="profile-email" value={user.email} disabled readOnly />
                <Lock size={14} aria-hidden="true" />
              </div>
              <small className="profile-field-hint">{t("auth.profile.emailLockedHint")}</small>
            </div>

            {error ? <Alert tone="error">{error}</Alert> : null}
            {success ? <Alert tone="success">{t("auth.profile.saved")}</Alert> : null}

            <div className="profile-form-footer">
              {hasUnsavedChanges ? (
                <span className="profile-unsaved-pill">{t("auth.profile.unsavedHint")}</span>
              ) : (
                <span />
              )}
              <Button
                type="submit"
                icon={Save}
                loading={saving}
                disabled={!trimmedName || trimmedName.length < 2}
              >
                {t("auth.profile.save")}
              </Button>
            </div>
          </form>

          {/* Right: Arcade Journey & Security Cards */}
          <div className="profile-side-stack">
            <section className="profile-panel-card profile-arcade-card">
              <div className="profile-panel-head-row">
                <div>
                  <h3>
                    <Gamepad2 size={17} aria-hidden="true" /> {t("auth.profile.arcadeSnapshotTitle")}
                  </h3>
                </div>
                <Link className="community-panel-link" href="/games?tab=achievements">
                  {t("auth.profile.openArcade")} <ArrowRight size={14} aria-hidden="true" />
                </Link>
              </div>

              {me && me.totalRounds > 0 ? (
                <>
                  <div className="profile-arcade-metrics">
                    <span>
                      {t("community.games.arcade.roundsUnit", { count: me.totalRounds })}
                    </span>
                    <span>·</span>
                    <span>
                      {t("community.games.arcade.winsUnit", { count: me.totalWins })}
                    </span>
                  </div>

                  {unlockedBadges.length > 0 ? (
                    <div className="profile-badge-pills">
                      {unlockedBadges.map((badge) => (
                        <span key={badge.id} className="profile-unlocked-badge">
                          <CheckCircle2 size={13} aria-hidden="true" />
                          {t(`community.games.arcade.badges.${badge.id}.title`)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="profile-arcade-empty">
                  <Award size={20} aria-hidden="true" />
                  <p>{t("auth.profile.arcadeSnapshotEmpty")}</p>
                </div>
              )}
            </section>

            <section className="profile-panel-card profile-security-card">
              <div className="profile-panel-head">
                <h3>
                  <ShieldCheck size={17} aria-hidden="true" /> {t("auth.profile.securityTitle")}
                </h3>
                <p>{t("auth.profile.securityDesc")}</p>
              </div>
              <div className="profile-security-actions">
                <Link className="ui-button ui-button-secondary ui-button-sm" href="/change-password">
                  <KeyRound size={15} aria-hidden="true" /> {t("auth.change.title")}
                </Link>
              </div>
            </section>
          </div>
        </div>

        {/* Native <dialog> Avatar Cropper */}
        {cropImage ? (
          <dialog
            ref={cropDialogRef}
            className="avatar-crop-dialog"
            {...({ closedby: "any" } as Record<string, string>)}
            aria-labelledby="avatar-crop-title"
            onClose={() => setCropImage(null)}
          >
            <header className="avatar-crop-header">
              <div>
                <h1 id="avatar-crop-title">{t("auth.profile.cropTitle")}</h1>
                <p>{t("auth.profile.cropHelp")}</p>
              </div>
              <button
                type="button"
                className="ui-icon-button"
                aria-label={t("common.close")}
                onClick={() => cropDialogRef.current?.close()}
              >
                <X size={19} aria-hidden="true" />
              </button>
            </header>
            <div className="avatar-crop-area">
              <Cropper
                image={cropImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
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
              <Button variant="ghost" onClick={() => cropDialogRef.current?.close()}>
                {t("common.cancel")}
              </Button>
              <Button icon={Save} loading={saving} onClick={() => void saveCroppedAvatar()}>
                {t("auth.profile.applyCrop")}
              </Button>
            </div>
          </dialog>
        ) : null}
      </section>
    </AppShell>
  );
}
