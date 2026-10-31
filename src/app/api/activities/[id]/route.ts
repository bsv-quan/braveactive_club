import { NextResponse } from "next/server";
import {
  activityCommentsKey,
  activityDay,
  activitiesKey,
  activityNameDayKey,
  activityParticipantsKey,
  activityRecurrencesKey,
  activityVotesKey,
} from "@/lib/activities";
import { getRedis, getRedisCredentials } from "@/lib/redis";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  if (!getRedisCredentials()) {
    return NextResponse.json(
      { error: "Chưa kết nối Redis. Hãy cấu hình Redis để xóa hoạt động." },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const redis = getRedis();
  const activity = await redis.hget<{
    id: string;
    date: string | null;
    day?: string | null;
    title: string;
    recurrenceSeriesId?: string;
  }>(
    activitiesKey,
    id,
  );
  if (!activity) {
    return NextResponse.json({ error: "Không tìm thấy hoạt động." }, { status: 404 });
  }

  const seriesId = activity.recurrenceSeriesId;
  const storedActivities = await redis.hgetall<
    Record<
      string,
      {
        id: string;
        title: string;
        date: string | null;
        day?: string | null;
        recurrenceSeriesId?: string;
      }
    >
  >(activitiesKey);
  const activitiesToDelete = seriesId
    ? Object.values(storedActivities ?? {}).filter(
        (item) => item.recurrenceSeriesId === seriesId,
      )
    : [{ ...activity, id }];
  if (!activitiesToDelete.some((item) => item.id === id)) {
    activitiesToDelete.push({ ...activity, id });
  }

  await redis.hdel(
    activitiesKey,
    ...activitiesToDelete.map((item) => item.id),
  );
  const relatedKeys = activitiesToDelete.flatMap((item) => {
    const day = activityDay(item);
    return [
      activityParticipantsKey(item.id),
      activityVotesKey(item.id),
      activityCommentsKey(item.id),
      ...(day ? [activityNameDayKey(day, item.title)] : []),
    ];
  });
  if (relatedKeys.length) await redis.del(...relatedKeys);
  if (seriesId) await redis.hdel(activityRecurrencesKey, seriesId);
  return NextResponse.json({
    deleted: true,
    deletedOccurrences: activitiesToDelete.length,
  });
}
