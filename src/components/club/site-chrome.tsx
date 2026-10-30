import Link from "next/link";

type ClubHeaderProps = {
  currentPage: "overview" | "activities";
};

export function ClubHeader({ currentPage }: ClubHeaderProps) {
  return (
    <header className="topbar">
      <Link className="brand" href="/">
        <img
          className="brand-logo"
          src="/logos/braveactive.png"
          alt="Brave Active"
        />
      </Link>
      <nav className="main-nav" aria-label="Điều hướng chính">
        <Link
          className={currentPage === "overview" ? "nav-link active" : "nav-link"}
          href="/"
        >
          Tổng quan
        </Link>
        <Link
          className={currentPage === "activities" ? "nav-link active" : "nav-link"}
          href="/activities"
        >
          Hoạt động
        </Link>
      </nav>
    </header>
  );
}

export function ClubFooter() {
  return (
    <footer className="footer">
      <Link className="brand footer-brand" href="/">
        <img
          className="brand-logo footer-logo"
          src="/logos/bravesoft.png"
          alt="BraveSoft"
        />
      </Link>
      <span>Được tạo nên bởi những người thích cùng nhau vận động.</span>
      <span>© 2026 Brave Active Club</span>
    </footer>
  );
}
