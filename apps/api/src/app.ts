import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { healthRouter } from "./routes/health.js";
import { fissuresRouter } from "./routes/fissures.js";
import { loadoutsRouter } from "./routes/loadouts.js";
import { oracleRouter } from "./routes/oracle.js";
import { clerkMiddleware } from "./middleware/clerk.js";
import { type HonoVariables } from "./types.js";

const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export const app = new Hono<{ Variables: HonoVariables }>();

// Global middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: allowedOrigins,
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
  }),
);

// Public routes
app.route("/health", healthRouter);

// Authenticated routes
app.use("/api/*", clerkMiddleware);
app.route("/api/fissures", fissuresRouter);
app.route("/api/loadouts", loadoutsRouter);
app.route("/api/oracle", oracleRouter);

// 404 fallback
app.notFound((c) => c.json({ error: "Not found" }, 404));

// Unhandled error fallback
app.onError((err, c) => {
  console.error("[api] unhandled error", err);
  return c.json({ error: "Internal server error" }, 500);
});
