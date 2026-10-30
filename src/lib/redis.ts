import { Redis } from "@upstash/redis";

export function getRedisCredentials() {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return null;
  }

  return { url, token };
}

export function getRedis() {
  const credentials = getRedisCredentials();

  if (!credentials) {
    throw new Error(
      "Redis chưa được cấu hình. Hãy thêm UPSTASH_REDIS_REST_URL và UPSTASH_REDIS_REST_TOKEN trong Vercel hoặc file .env.local.",
    );
  }

  return new Redis(credentials);
}
