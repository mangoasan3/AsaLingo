import { AIContentCache } from "../../models";

const DEFAULT_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function readAiCache<T>(query: Record<string, unknown>): Promise<T | null> {
  const cached = await AIContentCache.findOne(query);

  if (!cached || cached.expiresAt <= new Date()) {
    return null;
  }

  return cached.content as T;
}

export async function writeAiCache(
  query: Record<string, unknown>,
  content: unknown,
  ttlMs = DEFAULT_CACHE_TTL_MS
): Promise<void> {
  await AIContentCache.findOneAndUpdate(
    query,
    {
      $set: {
        content,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    },
    { upsert: true }
  );
}
