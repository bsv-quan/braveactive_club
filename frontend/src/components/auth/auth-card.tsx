/** Centered card used by every authentication screen. */
export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="auth-card">
      <h1>{title}</h1>
      <p className="auth-subtitle">{subtitle}</p>
      {children}
      {footer ? <div className="auth-footer">{footer}</div> : null}
    </section>
  );
}
