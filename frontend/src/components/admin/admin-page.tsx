"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Dices } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { AdminActivitiesPanel } from "@/components/admin/admin-activities-panel";
import { AdminPostsPage } from "@/components/community/admin-posts-page";
import { Button } from "@/components/ui/button";
import { PasswordField } from "@/components/ui/form-controls";
import { useI18n } from "@/i18n/i18n-provider";
import { apiJson, errorMessage } from "@/lib/api/client";
import { copyToClipboard } from "@/lib/clipboard";

type User = { id: string; email: string; displayName: string; role: "user" | "admin" };
type Request = { id: string; email: string; displayName: string | null; purpose: "register" | "reset"; createdAt: string };
type Tab = "users" | "requests" | "posts" | "activities";
type Credentials = { email: string; password: string };

function generateTemporaryPassword() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const allCharacters = `${letters}${digits}`;
  const randomIndex = (maximum: number) => crypto.getRandomValues(new Uint8Array(1))[0] % maximum;
  const characters = [
    letters[randomIndex(letters.length)],
    digits[randomIndex(digits.length)],
    ...Array.from(crypto.getRandomValues(new Uint8Array(14)), (byte) => allCharacters[byte % allCharacters.length]),
  ];

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join("");
}

export function AdminPage() {
  const { user, loading } = useAuth();
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<User[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [userOffset, setUserOffset] = useState(0);
  const [requestOffset, setRequestOffset] = useState(0);
  const [more, setMore] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [editing, setEditing] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [credentialNotice, setCredentialNotice] = useState<Credentials | null>(null);

  const load = useCallback(async () => {
    if (user?.role !== "admin" || tab === "posts" || tab === "activities") return;
    setError("");
    try {
      if (tab === "users") {
        const data = await apiJson<{ users: User[]; hasMore: boolean }>(`/api/admin/users?offset=${userOffset}`);
        setUsers(data.users);
        setMore(data.hasMore);
      } else {
        const data = await apiJson<{ requests: Request[]; hasMore: boolean }>(`/api/admin/requests?offset=${requestOffset}`);
        setRequests(data.requests);
        setMore(data.hasMore);
      }
    } catch (reason) { setError(errorMessage(reason, t("admin.error"))); }
  }, [tab, user?.role, userOffset, requestOffset, t]);

  useEffect(() => { void load(); }, [load]);

  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setPassword("");
      setApproving(null);
      setEditing(null);
      setEmail("");
      setName("");
      setRole("user");
      await load();
    } catch (reason) { setError(errorMessage(reason, t("admin.error"))); }
    finally { setBusy(false); }
  }

  async function copyValue(key: string, value: string) {
    try {
      await copyToClipboard(value);
      setCopied(key);
      setError("");
    } catch (reason) {
      setError(errorMessage(reason, t("admin.copyError")));
    }
  }

  function makeTemporaryPassword() {
    try {
      setPassword(generateTemporaryPassword());
      setError("");
      setCopied(null);
    } catch (reason) {
      setError(errorMessage(reason, t("admin.passwordGenerationError")));
    }
  }

  function copyButton(key: string, value: string, label: string) {
    const isCopied = copied === key;
    const Icon = isCopied ? Check : Copy;
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="admin-row-action"
        icon={Icon}
        aria-label={isCopied ? t("admin.copied") : label}
        title={isCopied ? t("admin.copied") : label}
        onClick={() => void copyValue(key, value)}
      />
    );
  }

  function credentialSummary(credentials: Credentials) {
    return (
      <div className="admin-credentials" role="status">
        <strong>{t("admin.createdCredentials")}</strong>
        <div><span>{t("auth.login.email")}: {credentials.email}</span></div>
        <div><span>{t("admin.initialPassword")}: {credentials.password}</span>{copyButton("saved-password", credentials.password, t("admin.copyPassword"))}</div>
      </div>
    );
  }

  if (loading) return <p>{t("common.loading")}</p>;
  if (!user || user.role !== "admin") return <p role="alert">{t("community.admin.accessDenied")}</p>;

  return (
    <section className="admin-console">
      <h1>{t("admin.title")}</h1>
      <nav className="admin-tabs" aria-label={t("admin.title")}>
        {(["users", "requests", "posts", "activities"] as const).map((item) => (
          <button key={item} type="button" className={tab === item ? "button-primary" : "button-secondary"}
            aria-pressed={tab === item} onClick={() => { setTab(item); setError(""); setEditing(null); setApproving(null); setPassword(""); setCredentialNotice(null); }}>
            {t(`admin.${item}`)}
          </button>
        ))}
      </nav>
      <div className="admin-error-slot" aria-live="polite">
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
      <div className="admin-panel">
        <div className="admin-panel-content">
          {tab === "posts" ? <AdminPostsPage /> : tab === "activities" ? <AdminActivitiesPanel /> : tab === "users" ? (
        <>
          {credentialNotice && credentialSummary(credentialNotice)}
          <form className="admin-form" onSubmit={(event) => {
            event.preventDefault();
            const submittedEmail = email.trim().toLowerCase();
            const submittedPassword = password;
            void perform(async () => {
              await apiJson(editing ? `/api/admin/users/${editing}` : "/api/admin/users", {
                method: editing ? "PATCH" : "POST",
                json: editing ? { displayName: name, role } : { email: submittedEmail, role, password: submittedPassword },
              });
              if (!editing) setCredentialNotice({ email: submittedEmail, password: submittedPassword });
            });
          }}>
            <h2>{editing ? t("admin.editUser") : t("admin.createUser")}</h2>
            {!editing && (
              <>
                <div className="admin-email-field">
                  <label>{t("auth.register.email")}<input type="email" required value={email} onChange={(e) => { setEmail(e.target.value); setCredentialNotice(null); }} /></label>
                </div>
                <p className="admin-form-hint">{t("admin.nameCanBeSetLater")}</p>
                <div className="admin-password-row">
                  <PasswordField label={t("admin.initialPassword")} name="initialPassword" required minLength={8} maxLength={128} value={password} onChange={(e) => { setPassword(e.target.value); setCopied(null); setCredentialNotice(null); }} autoComplete="new-password"
                    onCopy={password ? () => void copyValue("new-password", password) : undefined}
                    copyLabel={t("admin.copyPassword")} copiedLabel={t("admin.copied")} copied={copied === "new-password"} />
                  <Button className="admin-generate-password" type="button" variant="secondary" size="sm" icon={Dices} onClick={makeTemporaryPassword}>{t("admin.generatePassword")}</Button>
                </div>
              </>
            )}
            {editing && <label>{t("auth.register.displayName")}<input required minLength={2} maxLength={40} value={name} onChange={(e) => setName(e.target.value)} /></label>}
            <label>{t("admin.role")}<select className="ui-select" value={role} onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "user")}><option value="user">{t("admin.member")}</option><option value="admin">{t("admin.adminRole")}</option></select></label>
            <Button type="submit" loading={busy}>{t("admin.save")}</Button>
            {editing && <Button variant="ghost" onClick={() => { setEditing(null); setName(""); setRole("user"); }}>{t("common.cancel")}</Button>}
          </form>
          {users.map((item) => (
            <article key={item.id} className="admin-row">
              <span><strong>{item.displayName}</strong> · {item.email} · {item.role === "admin" ? t("admin.adminRole") : t("admin.member")}</span>
              <div className="admin-row-actions">
                <button className="button-secondary admin-row-action" type="button" onClick={() => { setEditing(item.id); setName(item.displayName); setRole(item.role); setCredentialNotice(null); }}>{t("admin.edit")}</button>
                {item.id !== user.id && <button className="button-secondary admin-row-action" type="button" disabled={busy} onClick={() => {
                  if (window.confirm(t("admin.deleteUserConfirm", { email: item.email }))) void perform(() => apiJson(`/api/admin/users/${item.id}`, { method: "DELETE" }));
                }}>{t("common.delete")}</button>}
              </div>
            </article>
          ))}
        </>
      ) : (
        <>
          <p>{t("admin.verifyIdentity")}</p>
          {credentialNotice && credentialSummary(credentialNotice)}
          {requests.length === 0 && <p>{t("admin.noRequests")}</p>}
          {requests.map((item) => (
            <article key={item.id} className="admin-row">
              <div><strong>{item.email}</strong> · {item.displayName} · {item.purpose === "register" ? t("admin.registration") : t("admin.reset")}<br /><time>{new Date(item.createdAt).toLocaleString()}</time></div>
              {approving === item.id ? (
                <form className="admin-form" onSubmit={(event) => {
                  event.preventDefault();
                  const submittedPassword = password;
                  void perform(async () => {
                    await apiJson(`/api/admin/requests/${item.id}/approve`, { method: "POST", json: { password: submittedPassword } });
                    setCredentialNotice({ email: item.email, password: submittedPassword });
                  });
                }}>
                  <div className="admin-password-row">
                  <PasswordField label={t("admin.initialPassword")} name="approvalPassword" minLength={8} maxLength={128} required value={password} onChange={(e) => { setPassword(e.target.value); setCopied(null); }} autoComplete="new-password"
                    onCopy={() => void copyValue("approval-password", password)} copyDisabled={!password}
                    copyLabel={t("admin.copyPassword")} copiedLabel={t("admin.copied")} copied={copied === "approval-password"} />
                  <Button className="admin-generate-password" type="button" variant="secondary" size="sm" icon={Dices} onClick={makeTemporaryPassword}>{t("admin.generatePassword")}</Button>
                </div>
                  <Button type="submit" loading={busy}>{t("admin.approve")}</Button>
                  <Button variant="ghost" onClick={() => { setApproving(null); setPassword(""); }}>{t("common.cancel")}</Button>
                </form>
              ) : <div><button className="button-primary" onClick={() => { setApproving(item.id); setPassword(""); }}>{t("admin.approve")}</button>{" "}
                <button className="button-secondary" disabled={busy} onClick={() => {
                  if (window.confirm(t("admin.rejectConfirm"))) void perform(() => apiJson(`/api/admin/requests/${item.id}`, { method: "DELETE" }));
                }}>{t("admin.reject")}</button></div>}
            </article>
          ))}
        </>
      )}
        </div>
        {tab !== "posts" && tab !== "activities" && <div className="admin-pagination">
          <Button variant="secondary" disabled={(tab === "users" ? userOffset : requestOffset) === 0} onClick={() => tab === "users" ? setUserOffset(Math.max(0, userOffset - 50)) : setRequestOffset(Math.max(0, requestOffset - 50))}>{t("admin.previous")}</Button>
          <Button variant="secondary" disabled={!more} onClick={() => tab === "users" ? setUserOffset(userOffset + 50) : setRequestOffset(requestOffset + 50)}>{t("admin.next")}</Button>
        </div>}
      </div>
    </section>
  );
}
