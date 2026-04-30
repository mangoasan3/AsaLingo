import path from "path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(__dirname, "../../../.env"), quiet: true });
loadEnv({ quiet: true });

function parseIntEnv(key: string, fallback: number) {
  const raw = process.env[key];
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseTrustProxy(value: string | undefined) {
  if (!value || value === "1") return 1;
  if (value === "true") return true;
  if (value === "false") return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : value;
}

export const env = {
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseIntEnv("PORT", 4000),
  MONGODB_URI: process.env.MONGODB_URI || "mongodb://localhost:27017/asalingo",
  JWT_SECRET: process.env.JWT_SECRET || "dev_jwt_secret_changeme",
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "dev_refresh_secret_changeme",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "15m",
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_CALLBACK_URL:
    process.env.GOOGLE_CALLBACK_URL || "http://localhost:4000/api/auth/google/callback",
  DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY || "",
  SMTP_HOST: process.env.SMTP_HOST || "smtp.ethereal.email",
  SMTP_PORT: parseIntEnv("SMTP_PORT", 587),
  SMTP_USER: process.env.SMTP_USER || "",
  SMTP_PASS: process.env.SMTP_PASS || "",
  SMTP_FROM: process.env.SMTP_FROM || "AsaLingo <noreply@asalingo.app>",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  BCRYPT_ROUNDS: parseIntEnv("BCRYPT_ROUNDS", 12),
  TRUST_PROXY: parseTrustProxy(process.env.TRUST_PROXY),
  API_RATE_LIMIT_WINDOW_MS: parseIntEnv("API_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  API_RATE_LIMIT_MAX: parseIntEnv("API_RATE_LIMIT_MAX", 200),
  AUTH_RATE_LIMIT_WINDOW_MS: parseIntEnv("AUTH_RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
  AUTH_LOGIN_RATE_LIMIT_MAX: parseIntEnv("AUTH_LOGIN_RATE_LIMIT_MAX", 8),
  AUTH_REGISTER_RATE_LIMIT_MAX: parseIntEnv("AUTH_REGISTER_RATE_LIMIT_MAX", 5),
  AUTH_FORGOT_PASSWORD_RATE_LIMIT_MAX: parseIntEnv("AUTH_FORGOT_PASSWORD_RATE_LIMIT_MAX", 5),
  AUTH_RESET_PASSWORD_RATE_LIMIT_MAX: parseIntEnv("AUTH_RESET_PASSWORD_RATE_LIMIT_MAX", 5),
  RATE_LIMIT_REDIS_URL: process.env.RATE_LIMIT_REDIS_URL || "",
};

const DEV_JWT_SECRET = "dev_jwt_secret_changeme";
const DEV_REFRESH_SECRET = "dev_refresh_secret_changeme";

/**
 * Run at server startup. Throws in production if critical secrets are defaults.
 * Logs a warning when AI keys are absent.
 */
export function validateEnvOnStartup(): void {
  if (env.NODE_ENV === "production") {
    if (env.JWT_SECRET === DEV_JWT_SECRET || env.JWT_REFRESH_SECRET === DEV_REFRESH_SECRET) {
      throw new Error(
        "FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be changed from dev defaults in production."
      );
    }
  }

  const hasAiKey = env.DEEPSEEK_API_KEY !== "";
  if (!hasAiKey) {
    console.warn(
      "[WARN] No AI API key configured (DEEPSEEK_API_KEY). " +
        "AI-optional helpers may fall back to stored data, but placement generation, roadmap lessons, " +
        "roadmap practice generation, and open-answer review will return 503 when AI is unavailable."
    );
  }
}
