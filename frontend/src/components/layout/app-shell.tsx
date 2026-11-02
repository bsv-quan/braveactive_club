import { ClubFooter, ClubHeader, type NavPage } from "./site-chrome";

/** Standard page frame: full-width shell with header and footer. */
export function AppShell({ currentPage, children }: { currentPage?: NavPage; children: React.ReactNode }) {
  return (
    <main className="app-main">
      <div className="page-shell app-shell">
        <ClubHeader currentPage={currentPage} />
        {children}
        <ClubFooter />
      </div>
    </main>
  );
}
