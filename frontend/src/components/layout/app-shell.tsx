import { ClubFooter, ClubHeader, type NavPage } from "./site-chrome";
import { FeedbackWidget } from "./feedback-widget";

/** Standard page frame: full-width shell with header and footer. */
export function AppShell({ currentPage, children }: { currentPage?: NavPage; children: React.ReactNode }) {
  return (
    <main className="app-main">
      <div className={`page-shell app-shell${currentPage === "community" ? " community-page-shell" : ""}`}>
        <ClubHeader currentPage={currentPage} />
        {children}
        <ClubFooter />
      </div>
      <FeedbackWidget />
    </main>
  );
}
