"use client";

import { ArrowRight, Gamepad2, Trophy, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { GameZoneIllustration } from "@/components/games/illustrations/game-zone-illustration";
import { useI18n } from "@/i18n/i18n-provider";
import { ARCADE_GAMES } from "@/lib/games/registry";

export function CommunityGamesDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);

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

  return (
    <dialog
      ref={dialogRef}
      className="community-games-dialog"
      {...({ closedby: "any" } as Record<string, string>)}
      aria-labelledby="community-games-title"
      onClose={onClose}
    >
      <header className="community-games-dialog-header">
        <div className="community-games-dialog-title">
          <span className="community-games-dialog-icon" aria-hidden="true">
            <Gamepad2 size={20} />
          </span>
          <div>
            <p>{t("community.games.arcade.kicker")}</p>
            <h1 id="community-games-title">{t("community.games.arcade.title")}</h1>
          </div>
        </div>
        <button
          type="button"
          className="ui-icon-button"
          aria-label={t("common.close")}
          onClick={() => dialogRef.current?.close()}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <p className="community-games-dialog-intro">{t("community.games.arcade.subtitle")}</p>
      <section className="community-games-selection" aria-label={t("community.games.chooseGame")}>
        <div className="community-games-options community-games-options-grid">
          {ARCADE_GAMES.map((zone) => (
            <Link
              key={zone.slug}
              className={`community-games-option is-${zone.slug}`}
              href={`/games/${zone.slug}`}
              onClick={() => dialogRef.current?.close()}
            >
              <span className="community-games-option-art">
                <GameZoneIllustration slug={zone.slug} />
              </span>
              <span className="community-games-option-copy">
                <strong>{t(`community.games.${zone.i18nKey}.title`)}</strong>
                <span>{t(`community.games.${zone.i18nKey}.description`)}</span>
              </span>
              <ArrowRight className="community-games-option-arrow" size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
        <div className="community-games-dialog-footer">
          <Link
            className="ui-button ui-button-primary"
            href="/games?tab=achievements"
            onClick={() => dialogRef.current?.close()}
          >
            <Trophy size={16} aria-hidden="true" /> {t("community.games.arcade.tabAchievements")}
          </Link>
        </div>
      </section>
    </dialog>
  );
}
