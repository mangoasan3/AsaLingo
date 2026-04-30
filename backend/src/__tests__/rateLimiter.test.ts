import express from "express";
import request from "supertest";

describe("auth rate limiters", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.RATE_LIMIT_REDIS_URL = "";
    process.env.AUTH_RATE_LIMIT_WINDOW_MS = "60000";
  });

  test("login limiter skips successful requests and throttles repeated failures", async () => {
    process.env.AUTH_LOGIN_RATE_LIMIT_MAX = "2";
    const { loginRateLimiter } = await import("../middleware/rateLimiter");

    const app = express();
    app.set("trust proxy", 1);
    app.use(express.json());
    app.post("/login", loginRateLimiter, (req, res) => {
      if (req.body.password === "ok") {
        res.status(200).json({ success: true });
        return;
      }
      res.status(401).json({ success: false });
    });

    await request(app).post("/login").send({ email: "learner@example.com", password: "ok" }).expect(200);
    await request(app).post("/login").send({ email: "learner@example.com", password: "bad" }).expect(401);
    await request(app).post("/login").send({ email: "learner@example.com", password: "bad" }).expect(401);
    await request(app).post("/login").send({ email: "learner@example.com", password: "bad" }).expect(429);
  });

  test("register limiter uses the stricter configured cap", async () => {
    process.env.AUTH_REGISTER_RATE_LIMIT_MAX = "1";
    const { registerRateLimiter } = await import("../middleware/rateLimiter");

    const app = express();
    app.set("trust proxy", 1);
    app.use(express.json());
    app.post("/register", registerRateLimiter, (_req, res) => {
      res.status(201).json({ success: true });
    });

    await request(app).post("/register").send({ email: "new@example.com" }).expect(201);
    await request(app).post("/register").send({ email: "new@example.com" }).expect(429);
  });
});
