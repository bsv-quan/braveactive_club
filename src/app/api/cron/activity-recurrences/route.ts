import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  activitiesKey,
  activityNameDayKey,
  activityRecurrenceLockKey,
  activityRecurrencesKey,
  nextActivityDay,
  type ActivityRecurrence,
  type ClubActivity,
} from "@/lib/activities";
import { getRedis, getRedisCredentials } from "@/lib/redis";

export const runtime = "nodejs";

const maxOccurrencesPerSeriesPerRun = 100;

function isValidDay(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isComplete(recurrence: ActivityRecurrence) {
  return (
    (recurrence.endType === "count" &&
      recurrence.occurrenceCount >= (recurrence.count ?? 0)) ||
    (recurrence.endType === "until" &&
      recurrence.nextDay > (recurrence.until ?? ""))
  );
}

function parseRecurrence(value: unknown): ActivityRecurrence | null {
  let recurrence = value;
  if (typeof value === "string") {
    try {
      recurrence = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (
    typeof recurrence !== "object" ||
    recurrence === null ||
    !("id" in recurrence) ||
    !("interval" in recurrence) ||
    !("endType" in recurrence) ||
    !("nextDay" in recurrence) ||
    !("occurrenceCount" in recurrence) ||
    !("anchorDay" in recurrence) ||
    !("template" in recurrence)
  ) {
    return null;
  }
  const item = recurrence as ActivityRecurrence;
  if (
    typeof item.id !== "string" ||
    (item.interval !== "daily" &&
      item.interval !== "weekly" &&
      item.interval !== "monthly") ||
    (item.endType !== "never" &&
      item.endType !== "count" &&
      item.endType !== "until") ||
    !isValidDay(item.nextDay) ||
    !Number.isInteger(item.occurrenceCount) ||
    !Number.isInteger(item.anchorDay) ||
    item.anchorDay < 1 ||
    item.anchorDay > 31 ||
    typeof item.template !== "object" ||
    item.template === null ||
    typeof item.template.title !== "string" ||
    typeof item.template.description !== "string" ||
    typeof item.template.creator !== "string" ||
    typeof item.template.category !== "string" ||
    item.template.scheduleType !== "scheduled" ||
    typeof item.template.date !== "string" ||
    Number.isNaN(Date.parse(item.template.date)) ||
    (item.endType === "count" &&
      (!Number.isInteger(item.count) || (item.count ?? 0) < 2)) ||
    (item.endType === "until" &&
      (typeof item.until !== "string" || !isValidDay(item.until)))
  ) {
    return null;
  }
  return item;
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "Chưa cấu hình CRON_SECRET cho tác vụ lặp hoạt động." },
      { status: 503 },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Không được phép." }, { status: 401 });
  }
  if (!getRedisCredentials()) {
    return NextResponse.json(
      { error: "Chưa kết nối Redis để tạo hoạt động lặp." },
      { status: 503 },
    );
  }

  const redis = getRedis();
  const lock = await redis.set(activityRecurrenceLockKey, randomUUID(), {
    nx: true,
    ex: 600,
  });
  if (lock !== "OK") {
    return NextResponse.json({ skipped: true, reason: "already-running" });
  }

  const stored = await redis.hgetall<Record<string, ActivityRecurrence>>(
    activityRecurrencesKey,
  );
  const horizon = new Date();
  horizon.setUTCDate(horizon.getUTCDate() + 90);
  const horizonDay = horizon.toISOString().slice(0, 10);
  let created = 0;
  let skippedDuplicates = 0;
  let removed = 0;

  for (const [seriesId, storedValue] of Object.entries(stored ?? {})) {
    const parsed = parseRecurrence(storedValue);
    if (!parsed) {
      console.warn(`Bỏ qua cấu hình lặp không hợp lệ "${seriesId}".`);
      continue;
    }

    let recurrence = parsed;
    if (isComplete(recurrence)) {
      await redis.hdel(activityRecurrencesKey, seriesId);
      removed += 1;
      continue;
    }

    let processed = 0;
    while (
      recurrence.nextDay <= horizonDay &&
      processed < maxOccurrencesPerSeriesPerRun
    ) {
      if (isComplete(recurrence)) {
        await redis.hdel(activityRecurrencesKey, seriesId);
        removed += 1;
        break;
      }

      const occurrenceId = randomUUID();
      const reservationKey = activityNameDayKey(
        recurrence.nextDay,
        recurrence.template.title,
      );
      const reserved = await redis.set(reservationKey, occurrenceId, {
        nx: true,
      });

      if (reserved === "OK") {
        const time =
          recurrence.template.date?.slice(11, 19) ?? "12:00:00";
        const occurrence: ClubActivity = {
          ...recurrence.template,
          id: occurrenceId,
          recurrenceSeriesId: recurrence.id,
          date: new Date(`${recurrence.nextDay}T${time}.000Z`).toISOString(),
          day: recurrence.nextDay,
          createdAt: new Date().toISOString(),
          participants: [],
          votes: {},
        };
        try {
          await redis.hset(activitiesKey, { [occurrence.id]: occurrence });
          created += 1;
        } catch (error) {
          await redis.del(reservationKey);
          throw error;
        }
      } else {
        console.warn(
          `Bỏ qua lần lặp "${recurrence.template.title}" ngày ${recurrence.nextDay}: đã có hoạt động cùng tên.`,
        );
        skippedDuplicates += 1;
      }

      processed += 1;
      recurrence = {
        ...recurrence,
        occurrenceCount: recurrence.occurrenceCount + 1,
        nextDay: nextActivityDay(
          recurrence.nextDay,
          recurrence.interval,
          recurrence.anchorDay,
        ),
      };

      if (isComplete(recurrence)) {
        await redis.hdel(activityRecurrencesKey, seriesId);
        removed += 1;
        break;
      }
      await redis.hset(activityRecurrencesKey, { [seriesId]: recurrence });
    }
  }

  return NextResponse.json({ created, skippedDuplicates, completedSeries: removed });
}
