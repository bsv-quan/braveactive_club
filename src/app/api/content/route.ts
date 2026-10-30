import { NextResponse } from "next/server";
import {
  initialAnnouncements,
  initialPosts,
  type ClubAnnouncement,
  type ClubPost,
} from "@/lib/content";
import { getRedisCredentials, getRedis } from "@/lib/redis";

export const runtime = "nodejs";

export async function GET() {
  if (!getRedisCredentials()) {
    return NextResponse.json(
      {
        error:
          "Chưa kết nối Redis. Hãy thêm Redis integration trên Vercel hoặc cấu hình biến môi trường trong .env.local.",
      },
      { status: 503 },
    );
  }

  const redis = getRedis();
  const announcementsKey = "braveactive:announcements";
  const postsKey = "braveactive:posts";

  await Promise.all([
    redis.set(announcementsKey, initialAnnouncements, { nx: true }),
    redis.set(postsKey, initialPosts, { nx: true }),
  ]);

  const [announcements, posts] = await Promise.all([
    redis.get<ClubAnnouncement[]>(announcementsKey),
    redis.get<ClubPost[]>(postsKey),
  ]);

  if (!announcements || !posts) {
    throw new Error("Không thể đọc nội dung câu lạc bộ từ Redis.");
  }

  return NextResponse.json({ announcements, posts });
}
