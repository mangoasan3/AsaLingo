import rateLimit, {
  MemoryStore,
  type IncrementResponse,
  type Options,
  type Store,
} from "express-rate-limit";
import { createClient, type RedisClientType } from "redis";
import { env } from "../config/env";
import { logger } from "../utils/logger";

type RedisStoreClient = RedisClientType<Record<string, never>, Record<string, never>>;

let redisClientPromise: Promise<RedisStoreClient | null> | null = null;

function buildRateLimitMessage(message: string) {
  return { success: false, message };
}

function getClientIp(request: { ip?: string | null }) {
  return String(request.ip ?? "unknown").trim() || "unknown";
}

function getNormalizedEmail(value: unknown) {
  const email = String(value ?? "").trim().toLowerCase();
  return email || "anonymous";
}

async function getRedisClient(): Promise<RedisStoreClient | null> {
  if (!env.RATE_LIMIT_REDIS_URL) return null;

  if (!redisClientPromise) {
    redisClientPromise = (async () => {
      const client = createClient({ url: env.RATE_LIMIT_REDIS_URL }) as RedisStoreClient;

      client.on("error", (error) => {
        logger.warn(`Rate-limit Redis error: ${error}`);
      });

      try {
        await client.connect();
        logger.info("Rate-limit Redis store connected");
        return client;
      } catch (error) {
        logger.warn(`Rate-limit Redis unavailable, using in-memory store: ${error}`);
        try {
          if (client.isOpen) {
            await client.quit();
          }
        } catch {
          // Ignore Redis cleanup errors and fall back to memory.
        }
        return null;
      }
    })();
  }

  return redisClientPromise;
}

class ResilientRateLimitStore implements Store {
  localKeys = false;
  prefix: string;

  private memoryStore = new MemoryStore();
  private windowMs = 60_000;

  constructor(prefix: string) {
    this.prefix = prefix;
  }

  init(options: Options) {
    this.windowMs = options.windowMs;
    this.memoryStore.init(options);
  }

  private getRedisKey(key: string) {
    return `${this.prefix}:${key}`;
  }

  async get(key: string) {
    const client = await getRedisClient();
    if (!client) return this.memoryStore.get(key);

    try {
      const redisKey = this.getRedisKey(key);
      const rawHits = await client.get(redisKey);
      if (!rawHits) return undefined;

      const ttlMs = await client.pTTL(redisKey);
      return {
        totalHits: Number(rawHits),
        resetTime: ttlMs > 0 ? new Date(Date.now() + ttlMs) : undefined,
      };
    } catch (error) {
      logger.warn(`Rate-limit Redis get failed, using memory fallback: ${error}`);
      return this.memoryStore.get(key);
    }
  }

  async increment(key: string): Promise<IncrementResponse> {
    const client = await getRedisClient();
    if (!client) return this.memoryStore.increment(key);

    try {
      const redisKey = this.getRedisKey(key);
      const totalHits = await client.incr(redisKey);
      let ttlMs = await client.pTTL(redisKey);

      if (ttlMs <= 0) {
        await client.pExpire(redisKey, this.windowMs);
        ttlMs = this.windowMs;
      }

      return {
        totalHits,
        resetTime: new Date(Date.now() + ttlMs),
      };
    } catch (error) {
      logger.warn(`Rate-limit Redis increment failed, using memory fallback: ${error}`);
      return this.memoryStore.increment(key);
    }
  }

  async decrement(key: string) {
    const client = await getRedisClient();
    if (!client) {
      await this.memoryStore.decrement(key);
      return;
    }

    try {
      const redisKey = this.getRedisKey(key);
      const remaining = await client.decr(redisKey);
      if (remaining <= 0) {
        await client.del(redisKey);
      }
    } catch (error) {
      logger.warn(`Rate-limit Redis decrement failed, using memory fallback: ${error}`);
      await this.memoryStore.decrement(key);
    }
  }

  async resetKey(key: string) {
    const client = await getRedisClient();
    if (!client) {
      await this.memoryStore.resetKey(key);
      return;
    }

    try {
      await client.del(this.getRedisKey(key));
    } catch (error) {
      logger.warn(`Rate-limit Redis reset failed, using memory fallback: ${error}`);
      await this.memoryStore.resetKey(key);
    }
  }

  async resetAll() {
    await this.memoryStore.resetAll();
  }
}

function createStore(prefix: string) {
  return new ResilientRateLimitStore(prefix);
}

function createLimiter(options: Partial<Options> & { identifier: string; windowMs: number; limit: number }) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    passOnStoreError: true,
    store: createStore(options.identifier),
    ...options,
  });
}

function buildAuthKeyGenerator(routeKey: string) {
  return (request: { ip?: string | null; body?: Record<string, unknown> }) =>
    `${routeKey}:${getClientIp(request)}:${getNormalizedEmail(request.body?.email)}`;
}

export const rateLimiter = createLimiter({
  identifier: "api-global",
  windowMs: env.API_RATE_LIMIT_WINDOW_MS,
  limit: env.API_RATE_LIMIT_MAX,
  message: buildRateLimitMessage("Too many requests, please try again later."),
});

export const loginRateLimiter = createLimiter({
  identifier: "auth-login",
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_LOGIN_RATE_LIMIT_MAX,
  skipSuccessfulRequests: true,
  keyGenerator: buildAuthKeyGenerator("login"),
  message: buildRateLimitMessage("Too many login attempts. Please try again later."),
});

export const registerRateLimiter = createLimiter({
  identifier: "auth-register",
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_REGISTER_RATE_LIMIT_MAX,
  keyGenerator: buildAuthKeyGenerator("register"),
  message: buildRateLimitMessage("Too many registration attempts. Please try again later."),
});

export const forgotPasswordRateLimiter = createLimiter({
  identifier: "auth-forgot-password",
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_FORGOT_PASSWORD_RATE_LIMIT_MAX,
  keyGenerator: buildAuthKeyGenerator("forgot-password"),
  message: buildRateLimitMessage("Too many password reset requests. Please try again later."),
});

export const resetPasswordRateLimiter = createLimiter({
  identifier: "auth-reset-password",
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: env.AUTH_RESET_PASSWORD_RATE_LIMIT_MAX,
  keyGenerator: buildAuthKeyGenerator("reset-password"),
  message: buildRateLimitMessage("Too many password reset attempts. Please try again later."),
});
