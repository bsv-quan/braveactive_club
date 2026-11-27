"use client";

import { ArrowRight, Bot, Crown, Gamepad2, Grid3X3, Search, Shield, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useI18n } from "@/i18n/i18n-provider";

const gameOptions = [
  { slug: "dev-vs-ai", key: "devVsAi", Icon: Bot },
  { slug: "word-search", key: "wordSearch", Icon: Search },
  { slug: "chess", key: "chess", Icon: Crown },
  { slug: "xiangqi", key: "xiangqi", Icon: Shield },
  { slug: "go", key: "go", Icon: Grid3X3 },
] as const;

export function CommunityGamesDialog({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="community-games-dialog"
      aria-labelledby="community-games-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) dialogRef.current?.close();
      }}
    >
      <header className="community-games-dialog-header">
        <div className="community-games-dialog-title">
          <span className="community-games-dialog-icon" aria-hidden="true"><Gamepad2 size={20} /></span>
          <div>
            <p>{t("community.games.kicker")}</p>
            <h2 id="community-games-title">{t("community.games.title")}</h2>
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
      <p className="community-games-dialog-intro">{t("community.games.chooseGameIntro")}</p>
      <section className="community-games-selection" aria-label={t("community.games.chooseGame")}>
        <div className="community-games-options community-games-options-grid">
          {gameOptions.map(({ slug, key, Icon }) => (
            <Link
              key={slug}
              className={`community-games-option is-${slug}`}
              href={`/games/${slug}`}
              onClick={() => dialogRef.current?.close()}
            >
              <span className={`community-games-option-icon is-${slug}`}><Icon size={22} aria-hidden="true" /></span>
              <span className="community-games-option-copy">
                <strong>{t(`community.games.${key}.title`)}</strong>
                <span>{t(`community.games.${key}.description`)}</span>
              </span>
              <ArrowRight className="community-games-option-arrow" size={18} aria-hidden="true" />
            </Link>
          ))}
        </div>
      </section>
    </dialog>
  );
}
