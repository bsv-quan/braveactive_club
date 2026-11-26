"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CircleHelp, X } from "lucide-react";
import { useI18n } from "@/i18n/i18n-provider";
import type { MessageKey } from "@/i18n/messages/types";

type GuideGame = "word-search" | "chess" | "xiangqi" | "go";

const guidePages: Record<GuideGame, { title: MessageKey; body: MessageKey }[]> = {
  "word-search": [
    { title: "community.games.guide.wordSearch.page1Title", body: "community.games.guide.wordSearch.page1Body" },
  ],
  chess: [
    { title: "community.games.guide.chess.page1Title", body: "community.games.guide.chess.page1Body" },
    { title: "community.games.guide.chess.page2Title", body: "community.games.guide.chess.page2Body" },
    { title: "community.games.guide.chess.page3Title", body: "community.games.guide.chess.page3Body" },
  ],
  xiangqi: [
    { title: "community.games.guide.xiangqi.page1Title", body: "community.games.guide.xiangqi.page1Body" },
    { title: "community.games.guide.xiangqi.page2Title", body: "community.games.guide.xiangqi.page2Body" },
    { title: "community.games.guide.xiangqi.page3Title", body: "community.games.guide.xiangqi.page3Body" },
  ],
  go: [
    { title: "community.games.guide.go.page1Title", body: "community.games.guide.go.page1Body" },
    { title: "community.games.guide.go.page2Title", body: "community.games.guide.go.page2Body" },
    { title: "community.games.guide.go.page3Title", body: "community.games.guide.go.page3Body" },
  ],
};

export function GameGuideDialog({
  game,
  gameTitle,
  onClose,
}: {
  game: GuideGame;
  gameTitle: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [page, setPage] = useState(0);
  const pages = guidePages[game];
  const currentPage = pages[page];

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  function closeDialog() {
    dialogRef.current?.close();
    onClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="game-guide-dialog"
      aria-labelledby="game-guide-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) closeDialog();
      }}
    >
      <header className="game-guide-header">
        <div className="game-guide-heading">
          <span className="game-guide-icon" aria-hidden="true"><CircleHelp size={21} /></span>
          <div>
            <p>{t("community.games.guide.eyebrow")}</p>
            <h2 id="game-guide-title">{t("community.games.guide.title", { game: gameTitle })}</h2>
          </div>
        </div>
        <button type="button" className="ui-icon-button" aria-label={t("community.games.guide.close")} onClick={closeDialog}>
          <X size={20} aria-hidden="true" />
        </button>
      </header>

      <div className="game-guide-progress" aria-hidden="true">
        {pages.map((_, index) => <span key={index} className={index <= page ? "active" : ""} />)}
      </div>

      <section className="game-guide-content" aria-live="polite">
        <span className="game-guide-page-count">{t("community.games.guide.page", { current: page + 1, total: pages.length })}</span>
        <h3>{t(currentPage.title)}</h3>
        <p>{t(currentPage.body)}</p>
      </section>

      <footer className="game-guide-footer">
        {pages.length > 1 ? (
          <>
            <button type="button" className="game-guide-nav secondary" disabled={page === 0} onClick={() => setPage((value) => value - 1)}>
              <ChevronLeft size={17} aria-hidden="true" /> {t("community.games.guide.previous")}
            </button>
            {page < pages.length - 1 ? (
              <button type="button" className="game-guide-nav primary" onClick={() => setPage((value) => value + 1)}>
                {t("community.games.guide.next")} <ChevronRight size={17} aria-hidden="true" />
              </button>
            ) : (
              <button type="button" className="game-guide-nav primary" onClick={closeDialog}>{t("community.games.guide.close")}</button>
            )}
          </>
        ) : (
          <button type="button" className="game-guide-nav primary" onClick={closeDialog}>{t("community.games.guide.close")}</button>
        )}
      </footer>
    </dialog>
  );
}
