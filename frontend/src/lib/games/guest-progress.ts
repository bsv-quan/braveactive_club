/**
 * Shared client-side guest streak & daily hint storage across all mini-games.
 * Uses Asia/Ho_Chi_Minh calendar days to match backend streak boundaries.
 */

const GUEST_ATTENDANCE_STORAGE_KEY = "braveactive-game-attendance";
const DAILY_FREE_HINTS = 2;

export type GuestStreakState = {
  playedToday: boolean;
  streakDays: number;
};

export function vietnamTodayKey(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateKeyOffset(dateKey: string, offset: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
}

function guestHintKey(): string {
  return `braveactive-game-hints:${vietnamTodayKey()}`;
}

export function readGuestHintsRemaining(): number {
  if (typeof window === "undefined") return DAILY_FREE_HINTS;
  try {
    const used = Number(window.localStorage.getItem(guestHintKey()) ?? 0);
    return Math.max(0, DAILY_FREE_HINTS - (Number.isFinite(used) ? used : 0));
  } catch {
    return DAILY_FREE_HINTS;
  }
}

export function consumeGuestHint(): number {
  const remaining = Math.max(0, readGuestHintsRemaining() - 1);
  try {
    window.localStorage.setItem(guestHintKey(), String(DAILY_FREE_HINTS - remaining));
  } catch {
    // Ignore storage quota errors in private browsing.
  }
  return remaining;
}

function readGuestAttendanceDays(): string[] {
  const stored = window.localStorage.getItem(GUEST_ATTENDANCE_STORAGE_KEY);
  const days: unknown = stored ? JSON.parse(stored) : [];
  if (
    !Array.isArray(days) ||
    !days.every((day) => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day))
  ) {
    throw new Error("Stored guest attendance data is invalid.");
  }
  return [...new Set(days)].sort();
}

function computeGuestAttendanceStatus(days: string[]): GuestStreakState {
  const today = vietnamTodayKey();
  const eligibleDays = days.filter((day) => day <= today);
  const dates = new Set(eligibleDays);
  const latest = eligibleDays.at(-1);
  if (!latest || latest < dateKeyOffset(today, -1)) {
    return { playedToday: dates.has(today), streakDays: 0 };
  }
  let streakDays = 0;
  for (let day = latest; dates.has(day); day = dateKeyOffset(day, -1)) {
    streakDays += 1;
  }
  return { playedToday: dates.has(today), streakDays };
}

export function loadGuestStreak(): { status: GuestStreakState | null; error: boolean } {
  if (typeof window === "undefined") return { status: { playedToday: false, streakDays: 0 }, error: false };
  try {
    return { status: computeGuestAttendanceStatus(readGuestAttendanceDays()), error: false };
  } catch {
    return { status: null, error: true };
  }
}

export function recordGuestRoundAttendance(): { status: GuestStreakState | null; error: boolean } {
  if (typeof window === "undefined") return { status: null, error: false };
  try {
    const today = vietnamTodayKey();
    let existing: string[] = [];
    try {
      existing = readGuestAttendanceDays();
    } catch {
      existing = [];
    }
    const days = [...new Set([...existing, today])].sort().slice(-400);
    window.localStorage.setItem(GUEST_ATTENDANCE_STORAGE_KEY, JSON.stringify(days));
    return { status: computeGuestAttendanceStatus(days), error: false };
  } catch {
    return { status: null, error: true };
  }
}
