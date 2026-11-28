"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  BellRing,
  CalendarDays,
  Check,
  Clock3,
  Copy,
  Dices,
  FileText,
  KeyRound,
  MessageSquare,
  Pencil,
  Search,
  ShieldAlert,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";
import { AdminActivitiesPanel } from "@/components/admin/admin-activities-panel";
import { AdminFeedbackPanel } from "@/components/admin/admin-feedback-panel";
import { AdminSlackPanel } from "@/components/admin/admin-slack-panel";
import { AdminPostsPage } from "@/components/community/admin-posts-page";
import { Button } from "@/components/ui/button";
import { useDialog } from "@/components/ui/confirm-dialog";
import { PasswordField } from "@/components/ui/form-controls";
import { useI18n } from "@/i18n/i18n-provider";
import type { ClubActivity } from "@/lib/activities";
import { apiJson, errorMessage } from "@/lib/api/client";
import { communityApi } from "@/lib/api/community";
import { copyToClipboard } from "@/lib/clipboard";
import { foldSearchText } from "@/lib/community-filters";

type UserItem = { id: string; email: string; displayName: string; role: "user" | "admin" };
type AccountRequest = {
  id: string;
  email: string;
  displayName: string | null;
  purpose: "register" | "reset";
  createdAt: string;
};
type Tab = "users" | "requests" | "posts" | "activities" | "slack" | "feedback";
type Credentials = { email: string; password: string };

const TAB_ORDER: readonly Tab[] = ["users", "requests", "posts", "activities", "slack", "feedback"];

function generateTemporaryPassword() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const digits = "23456789";
  const allCharacters = `${letters}${digits}`;
  const randomIndex = (maximum: number) => crypto.getRandomValues(new Uint8Array(1))[0] % maximum;
  const characters = [
    letters[randomIndex(letters.length)],
    digits[randomIndex(digits.length)],
    ...Array.from(
      crypto.getRandomValues(new Uint8Array(14)),
      (byte) => allCharacters[byte % allCharacters.length],
    ),
  ];

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = randomIndex(index + 1);
    [characters[index], characters[swapIndex]] = [characters[swapIndex], characters[index]];
  }
  return characters.join("");
}

export function AdminPage() {
  const { user, loading } = useAuth();
  const { t, intlLocale } = useI18n();
  const { confirm } = useDialog();
  const searchParams = useSearchParams();
  const userSearchId = useId();
  const requestedTab = searchParams.get("tab");
  const initialTab: Tab =
    requestedTab && (TAB_ORDER as readonly string[]).includes(requestedTab)
      ? (requestedTab as Tab)
      : "users";
  const [tab, setTab] = useState<Tab>(initialTab);

  useEffect(() => {
    if (requestedTab && (TAB_ORDER as readonly string[]).includes(requestedTab)) {
      setTab(requestedTab as Tab);
    }
  }, [requestedTab]);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [requests, setRequests] = useState<AccountRequest[]>([]);
  const [pendingCounts, setPendingCounts] = useState({
    requests: 0,
    posts: 0,
    activities: 0,
  });
  const [userOffset, setUserOffset] = useState(0);
  const [requestOffset, setRequestOffset] = useState(0);
  const [more, setMore] = useState({ users: false, requests: false });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"user" | "admin">("user");
  const [addingUser, setAddingUser] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [credentialNotice, setCredentialNotice] = useState<Credentials | null>(null);

  // Load moderation queue counts once on mount so tabs show actionable badges immediately.
  useEffect(() => {
    if (user?.role !== "admin") return;
    let active = true;
    void Promise.allSettled([
      apiJson<{ requests: AccountRequest[] }>("/api/admin/requests?offset=0"),
      communityApi.listAdminPosts(null),
      apiJson<{ activities: ClubActivity[] }>("/api/admin/activities/pending?offset=0&limit=50"),
    ]).then(([reqRes, postRes, actRes]) => {
      if (!active) return;
      setPendingCounts({
        requests: reqRes.status === "fulfilled" ? reqRes.value.requests.length : 0,
        posts:
          postRes.status === "fulfilled"
            ? postRes.value.posts.filter((post) => !post.approved).length
            : 0,
        activities: actRes.status === "fulfilled" ? actRes.value.activities.length : 0,
      });
    });
    return () => {
      active = false;
    };
  }, [user?.role]);

  const load = useCallback(async () => {
    if (
      user?.role !== "admin" ||
      tab === "posts" ||
      tab === "activities" ||
      tab === "feedback" ||
      tab === "slack"
    ) {
      return;
    }
    setError("");
    try {
      if (tab === "users") {
        const data = await apiJson<{ users: UserItem[]; hasMore: boolean }>(
          `/api/admin/users?offset=${userOffset}`,
        );
        setUsers(data.users);
        setMore((current) => ({ ...current, users: data.hasMore }));
      } else {
        const data = await apiJson<{ requests: AccountRequest[]; hasMore: boolean }>(
          `/api/admin/requests?offset=${requestOffset}`,
        );
        setRequests(data.requests);
        setMore((current) => ({ ...current, requests: data.hasMore }));
        if (requestOffset === 0) {
          setPendingCounts((current) => ({ ...current, requests: data.requests.length }));
        }
      }
    } catch (reason) {
      setError(errorMessage(reason, t("admin.error")));
    }
  }, [tab, user?.role, userOffset, requestOffset, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredUsers = useMemo(() => {
    const trimmed = userSearch.trim();
    if (!trimmed) return users;
    const query = foldSearchText(trimmed);
    return users.filter(
      (item) =>
        foldSearchText(item.displayName).includes(query) ||
        item.email.toLowerCase().includes(trimmed.toLowerCase()),
    );
  }, [users, userSearch]);

  async function perform(action: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    try {
      await action();
      setPassword("");
      setAddingUser(false);
      setApproving(null);
      setEditing(null);
      setEmail("");
      setName("");
      setRole("user");
      await load();
    } catch (reason) {
      setError(errorMessage(reason, t("admin.error")));
    } finally {
      setBusy(false);
    }
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

  function closeUserForm() {
    setAddingUser(false);
    setEditing(null);
    setEmail("");
    setName("");
    setPassword("");
    setRole("user");
    setCopied(null);
    setError("");
  }

  function selectTab(nextTab: Tab) {
    setTab(nextTab);
    setError("");
    setAddingUser(false);
    setEditing(null);
    setApproving(null);
    setPassword("");
    setCredentialNotice(null);
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
        <div className="admin-credential-line">
          <span>
            {t("auth.login.email")}: <code>{credentials.email}</code>
          </span>
        </div>
        <div className="admin-credential-line">
          <span>
            {t("admin.initialPassword")}: <code>{credentials.password}</code>
          </span>
          {copyButton("saved-password", credentials.password, t("admin.copyPassword"))}
        </div>
      </div>
    );
  }

  if (loading) return <p className="feed-note">{t("common.loading")}</p>;
  if (!user || user.role !== "admin") return <p role="alert">{t("community.admin.accessDenied")}</p>;

  const totalPending =
    pendingCounts.requests + pendingCounts.posts + pendingCounts.activities;

  const tabItems = [
    { id: "users" as const, Icon: Users, badge: 0 },
    { id: "requests" as const, Icon: UserCheck, badge: pendingCounts.requests },
    { id: "posts" as const, Icon: FileText, badge: pendingCounts.posts },
    { id: "activities" as const, Icon: CalendarDays, badge: pendingCounts.activities },
    { id: "slack" as const, Icon: BellRing, badge: 0 },
    { id: "feedback" as const, Icon: MessageSquare, badge: 0 },
  ];

  return (
    <section className="admin-console admin-console-v2">
      <header className="editorial-folio-masthead admin-masthead">
        <div className="editorial-folio-top">
          <div className="community-dateline">
            <span className="community-edition-tag">{t("admin.kicker")}</span>
            {totalPending > 0 ? (
              <span className="editorial-folio-stat is-alert">
                <Clock3 size={13} aria-hidden="true" />
                {t("admin.pendingBadge", { count: totalPending })}
              </span>
            ) : null}
          </div>
        </div>
        <div className="editorial-folio-main">
          <div className="editorial-folio-copy">
            <h1>{t("admin.title")}</h1>
            <p>{t("admin.subtitle")}</p>
          </div>
        </div>
      </header>

      <div
        className="admin-tabs"
        role="tablist"
        aria-label={t("admin.title")}
        onKeyDown={(event) => {
          if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
          event.preventDefault();
          const currentIndex = TAB_ORDER.indexOf(tab);
          const delta = event.key === "ArrowRight" ? 1 : -1;
          const nextTab = TAB_ORDER[(currentIndex + delta + TAB_ORDER.length) % TAB_ORDER.length];
          selectTab(nextTab);
          document.getElementById(`admin-tab-${nextTab}`)?.focus();
        }}
      >
        {tabItems.map(({ id: item, Icon, badge }) => {
          const selected = tab === item;
          return (
            <button
              key={item}
              id={`admin-tab-${item}`}
              type="button"
              role="tab"
              tabIndex={selected ? 0 : -1}
              aria-selected={selected}
              className={`admin-tab-btn${selected ? " active" : ""}`}
              onClick={(event) => {
                selectTab(item);
                event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" });
              }}
            >
              <Icon size={15} aria-hidden="true" />
              <span className="admin-tab-label">{t(`admin.${item}`)}</span>
              {badge > 0 ? <span className="admin-tab-badge">{badge}</span> : null}
            </button>
          );
        })}
      </div>

      <div className="admin-error-slot" aria-live="polite">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="admin-panel" role="tabpanel" aria-labelledby={`admin-tab-${tab}`}>
        <div className="admin-panel-content">
          {tab === "posts" ? (
            <AdminPostsPage
              embedded
              onPendingCountChange={(count) =>
                setPendingCounts((current) =>
                  current.posts === count ? current : { ...current, posts: count },
                )
              }
            />
          ) : tab === "activities" ? (
            <AdminActivitiesPanel
              onPendingCountChange={(count) =>
                setPendingCounts((current) =>
                  current.activities === count ? current : { ...current, activities: count },
                )
              }
            />
          ) : tab === "feedback" ? (
            <AdminFeedbackPanel />
          ) : tab === "slack" ? (
            <AdminSlackPanel />
          ) : tab === "users" ? (
            <div className="admin-users-section">
              {credentialNotice && credentialSummary(credentialNotice)}

              <div className="admin-users-toolbar">
                <search className="admin-users-search">
                  <label htmlFor={userSearchId} className="community-sr-only">
                    {t("admin.searchUsersPlaceholder")}
                  </label>
                  <span className="community-search-icon" aria-hidden="true">
                    <Search size={15} />
                  </span>
                  <input
                    id={userSearchId}
                    className="community-search-input"
                    type="search"
                    value={userSearch}
                    placeholder={t("admin.searchUsersPlaceholder")}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    onChange={(event) => setUserSearch(event.target.value)}
                  />
                  {userSearch ? (
                    <button
                      type="button"
                      className="community-search-clear"
                      aria-label={t("common.close")}
                      onClick={() => setUserSearch("")}
                    >
                      <X size={14} aria-hidden="true" />
                    </button>
                  ) : null}
                </search>

                {!addingUser && !editing ? (
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    icon={UserPlus}
                    onClick={() => {
                      setEmail("");
                      setPassword("");
                      setName("");
                      setRole("user");
                      setCopied(null);
                      setCredentialNotice(null);
                      setAddingUser(true);
                    }}
                  >
                    {t("admin.addNewUser")}
                  </Button>
                ) : null}
              </div>

              {addingUser || editing ? (
                <form
                  className="admin-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const submittedEmail = email.trim().toLowerCase();
                    const submittedPassword = password;
                    void perform(async () => {
                      await apiJson(editing ? `/api/admin/users/${editing}` : "/api/admin/users", {
                        method: editing ? "PATCH" : "POST",
                        json: editing
                          ? { displayName: name, role }
                          : { email: submittedEmail, role, password: submittedPassword },
                      });
                      if (!editing) {
                        setCredentialNotice({
                          email: submittedEmail,
                          password: submittedPassword,
                        });
                      }
                    });
                  }}
                >
                  <h2>{editing ? t("admin.editUser") : t("admin.createUser")}</h2>
                  {!editing && (
                    <>
                      <div className="admin-email-field">
                        <label>
                          {t("auth.register.email")}
                          <input
                            type="email"
                            required
                            value={email}
                            onChange={(e) => {
                              setEmail(e.target.value);
                              setCredentialNotice(null);
                            }}
                          />
                        </label>
                      </div>
                      <p className="admin-form-hint">{t("admin.nameCanBeSetLater")}</p>
                      <div className="admin-password-row">
                        <PasswordField
                          label={t("admin.initialPassword")}
                          name="initialPassword"
                          required
                          minLength={8}
                          maxLength={128}
                          value={password}
                          onChange={(e) => {
                            setPassword(e.target.value);
                            setCopied(null);
                            setCredentialNotice(null);
                          }}
                          autoComplete="new-password"
                          onCopy={
                            password ? () => void copyValue("new-password", password) : undefined
                          }
                          copyLabel={t("admin.copyPassword")}
                          copiedLabel={t("admin.copied")}
                          copied={copied === "new-password"}
                        />
                        <Button
                          className="admin-generate-password"
                          type="button"
                          variant="secondary"
                          size="sm"
                          icon={Dices}
                          onClick={makeTemporaryPassword}
                        >
                          {t("admin.generatePassword")}
                        </Button>
                      </div>
                    </>
                  )}
                  {editing && (
                    <label>
                      {t("auth.register.displayName")}
                      <input
                        required
                        minLength={2}
                        maxLength={40}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                      />
                    </label>
                  )}
                  <label>
                    {t("admin.role")}
                    <select
                      className="ui-select"
                      value={role}
                      onChange={(e) => setRole(e.target.value === "admin" ? "admin" : "user")}
                    >
                      <option value="user">{t("admin.member")}</option>
                      <option value="admin">{t("admin.adminRole")}</option>
                    </select>
                  </label>
                  <div className="admin-form-actions">
                    <Button type="submit" loading={busy}>
                      {t("admin.save")}
                    </Button>
                    <Button type="button" variant="ghost" disabled={busy} onClick={closeUserForm}>
                      {t("common.cancel")}
                    </Button>
                  </div>
                </form>
              ) : null}

              <div className="admin-list">
                {filteredUsers.length === 0 ? (
                  <p className="feed-note">{t("admin.noUsersMatch")}</p>
                ) : (
                  filteredUsers.map((item) => (
                    <article key={item.id} className="admin-row admin-card-row">
                      <div className="admin-user-summary">
                        <span className="admin-user-initial" aria-hidden="true">
                          {item.displayName.charAt(0).toUpperCase()}
                        </span>
                        <div className="admin-user-meta">
                          <div className="admin-user-name-row">
                            <strong>{item.displayName}</strong>
                            <span
                              className={`admin-role-badge${
                                item.role === "admin" ? " is-admin" : ""
                              }`}
                            >
                              {item.role === "admin" ? t("admin.adminRole") : t("admin.member")}
                            </span>
                          </div>
                          <span className="admin-user-email">{item.email}</span>
                        </div>
                      </div>
                      <div className="admin-row-actions">
                        <button
                          className="button-secondary admin-row-action"
                          type="button"
                          onClick={() => {
                            setAddingUser(false);
                            setEmail("");
                            setPassword("");
                            setEditing(item.id);
                            setName(item.displayName);
                            setRole(item.role);
                            setCredentialNotice(null);
                          }}
                        >
                          <Pencil size={13} aria-hidden="true" /> {t("admin.edit")}
                        </button>
                        {item.id !== user.id && (
                          <button
                            className="button-secondary admin-row-action is-danger-hover"
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              void confirm({
                                title: t("common.delete"),
                                message: t("admin.deleteUserConfirm", { email: item.email }),
                                confirmLabel: t("common.delete"),
                                tone: "danger",
                              }).then((ok) => {
                                if (ok) {
                                  void perform(() =>
                                    apiJson(`/api/admin/users/${item.id}`, { method: "DELETE" }),
                                  );
                                }
                              });
                            }}
                          >
                            <Trash2 size={13} aria-hidden="true" /> {t("common.delete")}
                          </button>
                        )}
                      </div>
                    </article>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="admin-requests-section">
              <aside className="admin-security-banner">
                <ShieldAlert size={18} aria-hidden="true" />
                <p>{t("admin.verifyIdentity")}</p>
              </aside>

              {credentialNotice && credentialSummary(credentialNotice)}

              {requests.length === 0 ? (
                <div className="feed-empty-card admin-empty-inline">
                  <span className="feed-empty-icon" aria-hidden="true">
                    <UserCheck size={22} />
                  </span>
                  <strong>{t("admin.noRequests")}</strong>
                </div>
              ) : (
                <div className="admin-list">
                  {requests.map((item) => (
                    <article key={item.id} className="admin-row admin-card-row is-request-card">
                      <div className="admin-user-summary">
                        <span className="admin-user-initial is-request" aria-hidden="true">
                          {item.purpose === "register" ? (
                            <UserPlus size={16} />
                          ) : (
                            <KeyRound size={16} />
                          )}
                        </span>
                        <div className="admin-user-meta">
                          <div className="admin-user-name-row">
                            <strong>{item.email}</strong>
                            <span
                              className={`admin-status-pill ${
                                item.purpose === "register" ? "is-info" : "is-warning"
                              }`}
                            >
                              {item.purpose === "register"
                                ? t("admin.registration")
                                : t("admin.reset")}
                            </span>
                          </div>
                          <span className="admin-user-email">
                            {item.displayName ? `${item.displayName} · ` : ""}
                            <time dateTime={item.createdAt}>
                              {new Intl.DateTimeFormat(intlLocale, {
                                dateStyle: "medium",
                                timeStyle: "short",
                              }).format(new Date(item.createdAt))}
                            </time>
                          </span>
                        </div>
                      </div>

                      {approving === item.id ? (
                        <form
                          className="admin-form admin-request-form"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const submittedPassword = password;
                            void perform(async () => {
                              await apiJson(`/api/admin/requests/${item.id}/approve`, {
                                method: "POST",
                                json: { password: submittedPassword },
                              });
                              setCredentialNotice({
                                email: item.email,
                                password: submittedPassword,
                              });
                            });
                          }}
                        >
                          <div className="admin-password-row">
                            <PasswordField
                              label={t("admin.initialPassword")}
                              name="approvalPassword"
                              minLength={8}
                              maxLength={128}
                              required
                              value={password}
                              onChange={(e) => {
                                setPassword(e.target.value);
                                setCopied(null);
                              }}
                              autoComplete="new-password"
                              onCopy={() => void copyValue("approval-password", password)}
                              copyDisabled={!password}
                              copyLabel={t("admin.copyPassword")}
                              copiedLabel={t("admin.copied")}
                              copied={copied === "approval-password"}
                            />
                            <Button
                              className="admin-generate-password"
                              type="button"
                              variant="secondary"
                              size="sm"
                              icon={Dices}
                              onClick={makeTemporaryPassword}
                            >
                              {t("admin.generatePassword")}
                            </Button>
                          </div>
                          <div className="admin-form-actions">
                            <Button type="submit" loading={busy}>
                              {t("admin.approve")}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                setApproving(null);
                                setPassword("");
                              }}
                            >
                              {t("common.cancel")}
                            </Button>
                          </div>
                        </form>
                      ) : (
                        <div className="admin-row-actions">
                          <Button
                            type="button"
                            variant="primary"
                            size="sm"
                            icon={Check}
                            onClick={() => {
                              setApproving(item.id);
                              setPassword("");
                            }}
                          >
                            {t("admin.approve")}
                          </Button>
                          <button
                            type="button"
                            className="button-secondary admin-row-action is-danger-hover"
                            disabled={busy}
                            onClick={() => {
                              void confirm({
                                title: t("admin.reject"),
                                message: t("admin.rejectConfirm"),
                                confirmLabel: t("admin.reject"),
                                tone: "danger",
                              }).then((ok) => {
                                if (ok) {
                                  void perform(() =>
                                    apiJson(`/api/admin/requests/${item.id}`, {
                                      method: "DELETE",
                                    }),
                                  );
                                }
                              });
                            }}
                          >
                            {t("admin.reject")}
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        {(tab === "users" || tab === "requests") &&
          ((tab === "users" ? userOffset : requestOffset) > 0 || more[tab]) && (
            <div className="admin-pagination">
              {(tab === "users" ? userOffset : requestOffset) > 0 && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    tab === "users"
                      ? setUserOffset(Math.max(0, userOffset - 50))
                      : setRequestOffset(Math.max(0, requestOffset - 50))
                  }
                >
                  {t("admin.previous")}
                </Button>
              )}
              {more[tab] && (
                <Button
                  variant="secondary"
                  onClick={() =>
                    tab === "users"
                      ? setUserOffset(userOffset + 50)
                      : setRequestOffset(requestOffset + 50)
                  }
                >
                  {t("admin.next")}
                </Button>
              )}
            </div>
          )}
      </div>
    </section>
  );
}
