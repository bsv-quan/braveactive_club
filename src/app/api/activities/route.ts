import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  activitiesKey,
  activityDay,
  activityCommentsKey,
  activityNameDayKey,
  type ActivityComment,
  activityParticipantsKey,
  activityVotesKey,
  isActivityCategory,
  normalizeActivityTitle,
  type ClubActivity,
} from "@/lib/activities";
import { getRedis, getRedisCredentials } from "@/lib/redis";

export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}T/.test(value) && !Number.isNaN(Date.parse(value));
}

function validDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function validVoteDay(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseVoteRecord(memberKey: string, value: unknown) {
  let parsed: unknown = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      const legacyDates = value.split(",").map((date) => date.trim());
      if (legacyDates.every(validVoteDay)) {
        return { name: memberKey, dates: legacyDates };
      }
      console.warn(`Bỏ qua lượt bình chọn cũ không hợp lệ của "${memberKey}".`);
      return null;
    }
  }

  if (Array.isArray(parsed) && parsed.every(validVoteDay)) {
    return { name: memberKey, dates: parsed };
  }
  if (
    isRecord(parsed) &&
    typeof parsed.name === "string" &&
    Array.isArray(parsed.dates) &&
    parsed.dates.every(validVoteDay)
  ) {
    return { name: parsed.name, dates: parsed.dates };
  }

  console.warn(`Bỏ qua lượt bình chọn cũ không hợp lệ của "${memberKey}".`);
  return null;
}

export async function GET() {
  if (!getRedisCredentials()) {
    return NextResponse.json(
      { error: "Chưa kết nối Redis. Hãy cấu hình Redis để xem hoạt động." },
      { status: 503 },
    );
  }

  const redis = getRedis();
  const stored = await redis.hgetall<Record<string, ClubActivity>>(activitiesKey);
  const activities = await Promise.all(
    Object.values(stored ?? {}).map(async (activity) => {
      const [participants, storedVotes, storedComments] = await Promise.all([
        redis.hgetall<Record<string, string>>(
          activityParticipantsKey(activity.id),
        ),
        redis.hgetall<Record<string, string>>(
          activityVotesKey(activity.id),
        ),
        redis.hgetall<Record<string, ActivityComment>>(
          activityCommentsKey(activity.id),
        ),
      ]);
      const votes: Record<string, string[]> = {};
      for (const [memberKey, vote] of Object.entries(storedVotes ?? {})) {
        const parsed = parseVoteRecord(memberKey, vote);
        if (!parsed) continue;
        for (const date of parsed.dates) {
          votes[date] = [...(votes[date] ?? []), parsed.name];
        }
      }
      return {
        ...activity,
        scheduleType: activity.scheduleType ?? "scheduled",
        createdAt: activity.createdAt ?? "1970-01-01T00:00:00.000Z",
        participants: Object.values(participants ?? {}),
        votes,
        comments: Object.values(storedComments ?? {}).sort(
          (first, second) => first.createdAt.localeCompare(second.createdAt),
        ),
      };
    }),
  );

  activities.sort((first, second) =>
    second.createdAt.localeCompare(first.createdAt),
  );
  return NextResponse.json({ activities });
}

export async function POST(request: NextRequest) {
  if (!getRedisCredentials()) {
    return NextResponse.json(
      { error: "Chưa kết nối Redis. Hãy cấu hình Redis để tạo hoạt động." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  if (!isRecord(body) || typeof body.title !== "string") {
    return NextResponse.json(
      { error: "Vui lòng nhập tên hoạt động." },
      { status: 400 },
    );
  }

  const isQuickSignup = body.kind === "quick-signup";
  if (body.kind !== undefined && body.kind !== "activity" && !isQuickSignup) {
    return NextResponse.json(
      { error: "Loại đăng ký không hợp lệ." },
      { status: 400 },
    );
  }
  if (
    !isQuickSignup &&
    (typeof body.description !== "string" ||
      typeof body.category !== "string" ||
      (body.scheduleType !== "scheduled" && body.scheduleType !== "poll") ||
      typeof body.creator !== "string")
  ) {
    return NextResponse.json(
      { error: "Vui lòng nhập nội dung, loại, lịch và tên người tạo." },
      { status: 400 },
    );
  }

  const title = body.title.trim();
  const description = isQuickSignup ? "Đăng ký nhanh theo ngày." : (body.description as string).trim();
  const creator = isQuickSignup
    ? "Cộng đồng"
    : (body.creator as string).trim().replace(/\s+/g, " ");
  const category = isQuickSignup
    ? "THỂ THAO"
    : body.category;
  const scheduleType = isQuickSignup ? "scheduled" : body.scheduleType as "scheduled" | "poll";
  const quickDay =
    isQuickSignup && typeof body.day === "string" ? body.day : null;
  const date =
    isQuickSignup && quickDay && validDay(quickDay)
      ? `${quickDay}T12:00:00.000Z`
      : scheduleType === "scheduled" && typeof body.date === "string"
      ? body.date
      : null;
  const day =
    isQuickSignup
      ? quickDay
      : scheduleType === "scheduled" && typeof body.day === "string"
      ? body.day
      : date?.slice(0, 10) ?? null;
  if (
    title.length < (isQuickSignup ? 2 : 3) ||
    title.length > 120 ||
    description.length < 5 ||
    description.length > 1000 ||
    creator.length < 2 ||
    creator.length > 40 ||
    !isActivityCategory(category) ||
    (isQuickSignup && (!day || !validDay(day))) ||
    (scheduleType === "scheduled" &&
      (!date ||
        !validDate(date) ||
        !day ||
        !validDay(day))) ||
    (scheduleType === "poll" && body.date !== null)
  ) {
    return NextResponse.json(
      { error: "Thông tin hoạt động chưa hợp lệ. Vui lòng kiểm tra lại các trường." },
      { status: 400 },
    );
  }

  const redis = getRedis();
  if (scheduleType === "scheduled" && day) {
    const stored = await redis.hgetall<Record<string, ClubActivity>>(activitiesKey);
    const duplicate = Object.values(stored ?? {}).some(
      (existing) =>
        existing.scheduleType !== "poll" &&
        activityDay(existing) === day &&
        normalizeActivityTitle(existing.title) === normalizeActivityTitle(title),
    );
    if (duplicate) {
      return NextResponse.json(
        { error: "Đã có hoạt động cùng tên trong ngày này." },
        { status: 409 },
      );
    }
  }

  const activity: ClubActivity = {
    id: randomUUID(),
    kind: isQuickSignup ? "quick-signup" : "activity",
    title,
    description,
    category,
    scheduleType,
    date: date ? new Date(date).toISOString() : null,
    day,
    createdAt: new Date().toISOString(),
    creator,
    participants: [],
    votes: {},
  };

  if (day) {
    const reserved = await redis.set(
      activityNameDayKey(day, title),
      activity.id,
      { nx: true },
    );
    if (reserved !== "OK") {
      return NextResponse.json(
        { error: "Đã có hoạt động cùng tên trong ngày này." },
        { status: 409 },
      );
    }
  }
  try {
    await redis.hset(activitiesKey, { [activity.id]: activity });
  } catch (error) {
    if (day) await redis.del(activityNameDayKey(day, title));
    throw error;
  }
  return NextResponse.json({ activity }, { status: 201 });
}
