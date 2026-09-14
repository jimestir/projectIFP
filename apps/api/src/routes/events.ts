import { Router } from "express";
import { pharmacyEvents, type PharmacyEvent } from "../lib/events.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const eventsRouter = Router();

function writeSse(
  res: import("express").Response,
  event: PharmacyEvent | { type: string; data?: unknown },
) {
  if ("pharmacyId" in event) {
    res.write(`event: ${event.type}\n`);
    res.write(`data: ${JSON.stringify(event)}\n\n`);
    return;
  }
  res.write(`event: ${event.type}\n`);
  res.write(`data: ${JSON.stringify(event.data ?? {})}\n\n`);
}

// EventSource cannot set Authorization headers; allow ?token= as fallback.
eventsRouter.get(
  "/pharmacy",
  (req, _res, next) => {
    if (!req.headers.authorization && typeof req.query.token === "string") {
      req.headers.authorization = `Bearer ${req.query.token}`;
    }
    next();
  },
  requireAuth,
  requireRole("PHARMACY", "ADMIN"),
  (req, res) => {
    const user = req.user!;

    const pharmacyId =
      user.role === "ADMIN" && typeof req.query.pharmacyId === "string"
        ? req.query.pharmacyId
        : user.pharmacyId;

    if (!pharmacyId) {
      res.status(403).json({ error: "Pharmacy account is not linked to a pharmacy" });
      return;
    }

    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    writeSse(res, {
      type: "connected",
      data: { pharmacyId, at: new Date().toISOString() },
    });

    const unsubscribe = pharmacyEvents.subscribe(pharmacyId, (event) => {
      writeSse(res, event);
    });

    const heartbeat = setInterval(() => {
      res.write(`: ping ${Date.now()}\n\n`);
    }, 25000);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
    };

    req.on("close", cleanup);
    req.on("error", cleanup);
  },
);
