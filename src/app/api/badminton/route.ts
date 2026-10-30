import { NextRequest, NextResponse } from "next/server";
import { getRedis, getRedisCredentials } from "@/lib/redis";

export const runtime = "nodejs";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

function isValidDate(value: string) {
  if (!datePattern.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function dateRange(from: string, to: string) {
  const dates: string[] = [];
  const current = new Date(`${from}T00:00:00.000Z`);
  const last = new Date(`${to}T00:00:00.000Z`);

  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }
  return dates;
}

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get("from") ?? "";
  const to = request.nextUrl.searchParams.get("to") ?? "";

  if (!isValidDate(from) || !isValidDate(to) || from > to) {
    return NextResponse.json(
      { error: "Khoảng ngày không hợp lệ." },
      { status: 400 },
    );
  }

  const dates = dateRange(from, to);
  if (dates.length > 42) {
    return NextResponse.json(
      { error: "Mỗi lần chỉ có thể xem tối đa 42 ngày." },
      { status: 400 },
    );
  }

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
  const registrations = await Promise.all(
    dates.map(async (date) => {
      const members = await redis.hgetall<Record<string, string>>(
        `braveactive:badminton:${date}`,
      );
      return [date, Object.values(members ?? {})] as const;
    }),
  );

  return NextResponse.json({ registrations: Object.fromEntries(registrations) });
}

export async function POST(request: NextRequest) {
  if (!getRedisCredentials()) {
    return NextResponse.json(
      {
        error:
          "Chưa kết nối Redis. Hãy thêm Redis integration trên Vercel hoặc cấu hình biến môi trường trong .env.local.",
      },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("date" in body) ||
    !("name" in body) ||
    typeof body.date !== "string" ||
    typeof body.name !== "string"
  ) {
    return NextResponse.json(
      { error: "Vui lòng nhập ngày và tên của bạn." },
      { status: 400 },
    );
  }

  const date = body.date;
  const name = body.name.trim().replace(/\s+/g, " ");
  if (!isValidDate(date) || name.length < 2 || name.length > 40) {
    return NextResponse.json(
      { error: "Tên cần từ 2 đến 40 ký tự và ngày phải hợp lệ." },
      { status: 400 },
    );
  }

  const redis = getRedis();
  const key = `braveactive:badminton:${date}`;
  const normalizedName = name.normalize("NFC").toLocaleLowerCase("vi");
  const inserted = await redis.hsetnx(key, normalizedName, name);

  if (!inserted) {
    return NextResponse.json(
      { error: "Tên này đã đăng ký cho ngày đã chọn rồi." },
      { status: 409 },
    );
  }

  return NextResponse.json({ date, name }, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!getRedisCredentials()) {
    return NextResponse.json(
      { error: "Chưa kết nối Redis. Hãy cấu hình Redis để xóa đăng ký." },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dữ liệu gửi lên không hợp lệ." }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("date" in body) ||
    !("name" in body) ||
    typeof body.date !== "string" ||
    typeof body.name !== "string"
  ) {
    return NextResponse.json(
      { error: "Vui lòng cung cấp ngày và tên cần xóa." },
      { status: 400 },
    );
  }

  const date = body.date;
  const name = body.name.trim().replace(/\s+/g, " ");
  if (!isValidDate(date) || name.length < 2 || name.length > 40) {
    return NextResponse.json(
      { error: "Ngày hoặc tên đăng ký không hợp lệ." },
      { status: 400 },
    );
  }

  const normalizedName = name.normalize("NFC").toLocaleLowerCase("vi");
  const deleted = await getRedis().hdel(
    `braveactive:badminton:${date}`,
    normalizedName,
  );
  if (!deleted) {
    return NextResponse.json(
      { error: "Không tìm thấy lượt đăng ký cần xóa." },
      { status: 404 },
    );
  }

  return NextResponse.json({ date, name, deleted: true });
}
