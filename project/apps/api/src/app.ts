import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGIN,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req, res) => {
    res.json({
      name: "Stock for PYMEs API",
      version: "0.1.0",
      docs: "/api/health",
    });
  });

  app.use("/api/health", healthRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: "Not found" });
  });

  return app;
}
