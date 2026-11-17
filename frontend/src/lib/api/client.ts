/**
 * Thin fetch wrapper for the backend API.
 *
 * - Requests go to the same origin (`/api/*`), which Next.js proxies to the Python
 *   backend, so the HttpOnly session cookie stays first-party.
 * - State-changing requests carry the CSRF token issued by `/api/auth/me|login|register`.
 */

let csrfToken: string | null = null;

export type GlobalApiErrorCode =
  | "network";

export type GlobalErrorDetail =
  | { type: "api"; code: GlobalApiErrorCode }
  | { type: "message"; message: string };

type GlobalErrorListener = (detail: GlobalErrorDetail) => void;
const globalErrorListeners = new Set<GlobalErrorListener>();
let currentGlobalError: GlobalErrorDetail | null = null;

function emitGlobalError(detail: GlobalErrorDetail) {
  currentGlobalError = detail;
  for (const listener of globalErrorListeners) listener(detail);
}

/** Subscribe to the latest shared error and replay it when the notice mounts. */
export function subscribeGlobalErrors(listener: GlobalErrorListener) {
  globalErrorListeners.add(listener);
  if (currentGlobalError) listener(currentGlobalError);
  return () => {
    globalErrorListeners.delete(listener);
  };
}

export function dismissGlobalError() {
  currentGlobalError = null;
}

/** Publish a localized UI error to the single, root-level notice. */
export function reportGlobalError(message: string) {
  emitGlobalError({ type: "message", message });
}

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

/** Fetch while attaching the session CSRF token to state-changing requests. */
export async function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (!SAFE_METHODS.has(method) && csrfToken) {
    headers.set("X-CSRF-Token", csrfToken);
  }
  try {
    return await fetch(input, { ...init, method, headers, credentials: "same-origin" });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiError("", 0);
  }
}

/** Fetch JSON and throw a status-only `ApiError` so raw server text is never shown. */
export async function apiJson<T>(
  path: string,
  init: RequestInit & { json?: unknown } = {},
): Promise<T> {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  let body = rest.body;
  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  }

  const response = await apiFetch(path, { ...rest, headers, body });
  const data = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) {
    throw new ApiError("", response.status);
  }
  return data;
}

/** Return the caller's localized fallback and publish it to the global error notice. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError && error.status === 0) {
    emitGlobalError({ type: "api", code: "network" });
  } else {
    reportGlobalError(fallback);
  }
  return fallback;
}
