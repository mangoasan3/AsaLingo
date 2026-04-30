import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import passport from "passport";

import { env, validateEnvOnStartup } from "./config/env";
import { logger } from "./utils/logger";
import { errorHandler } from "./middleware/errorHandler";
import { rateLimiter } from "./middleware/rateLimiter";
import { configurePassport } from "./config/passport";
import { router } from "./routes";
import { connectDB } from "./db/mongoose";

const app = express();
app.set("trust proxy", env.TRUST_PROXY);

function isAllowedOrigin(origin?: string): boolean {
  if (!origin) return true;
  if (origin === env.FRONTEND_URL) return true;

  if (env.NODE_ENV !== "production") {
    return /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin);
  }

  return false;
}

// ─── Security & middleware ────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("CORS origin not allowed"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(compression());
app.use(cookieParser());
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("combined", { stream: { write: (msg) => logger.http(msg.trim()) } }));

// ─── Auth ─────────────────────────────────────────────────────────────────────
configurePassport();
app.use(passport.initialize());

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use("/api", rateLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use("/api", router);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ─── Error handler ───────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start ────────────────────────────────────────────────────────────────────
validateEnvOnStartup();

const PORT = env.PORT;

connectDB().then(() => {
  const server = app.listen(PORT, () => {
    logger.info(`AsaLingo backend running on port ${PORT} [${env.NODE_ENV}]`);
  });

  function gracefulShutdown(signal: string) {
    logger.info(`${signal} received — shutting down gracefully`);
    server.close(() => {
      logger.info("HTTP server closed");
      process.exit(0);
    });
  }

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
});

export default app;
