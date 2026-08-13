import { Router } from "express";
import { Prisma, type ReservationStatus } from "@prisma/client";
import { pharmacyEvents } from "../lib/events.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  reservationCreateSchema,
  reservationUpdateSchema,
  type ReservationCreateInput,
  type ReservationUpdateInput,
} from "../schemas/reservation.js";

export const reservationsRouter = Router();

const RESERVATION_TTL_MS = 24 * 60 * 60 * 1000;

const reservationSelect = {
  id: true,
  userId: true,
  pharmacyId: true,
  productId: true,
  quantity: true,
  status: true,
  expiresAt: true,
  createdAt: true,
} as const;

function toReservation(row: {
  id: string;
  userId: string;
  pharmacyId: string;
  productId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
}) {
  return {
    id: row.id,
    userId: row.userId,
    pharmacyId: row.pharmacyId,
    productId: row.productId,
    quantity: row.quantity,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

type InventoryLockRow = {
  id: string;
  stock: number;
  version: number;
};

reservationsRouter.get("/", requireAuth, async (req, res) => {
  const user = req.user!;

  try {
    let where: Prisma.ReservationWhereInput;

    if (user.role === "CLIENT") {
      where = { userId: user.sub };
    } else if (user.role === "PHARMACY") {
      if (!user.pharmacyId) {
        res.status(403).json({ error: "Pharmacy account is not linked to a pharmacy" });
        return;
      }
      where = { pharmacyId: user.pharmacyId };
    } else {
      where = {};
    }

    const rows = await prisma.reservation.findMany({
      where,
      select: reservationSelect,
      orderBy: { createdAt: "desc" },
    });

    res.json(rows.map(toReservation));
  } catch (error) {
    console.error("listReservations error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

reservationsRouter.post(
  "/",
  requireAuth,
  requireRole("CLIENT"),
  validateBody(reservationCreateSchema),
  async (req, res) => {
    const user = req.user!;
    const body = req.body as ReservationCreateInput;

    try {
      const reservation = await prisma.$transaction(async (tx) => {
        const locked = await tx.$queryRaw<InventoryLockRow[]>`
          SELECT id, stock, version
          FROM inventory
          WHERE pharmacy_id = ${body.pharmacyId}::uuid
            AND product_id = ${body.productId}::uuid
          FOR UPDATE
        `;

        const item = locked[0];
        if (!item) {
          throw Object.assign(new Error("Inventory not found"), { code: "NOT_FOUND" });
        }

        if (item.stock < body.quantity) {
          throw Object.assign(new Error("Insufficient stock"), { code: "CONFLICT" });
        }

        await tx.inventory.update({
          where: { id: item.id },
          data: {
            stock: item.stock - body.quantity,
            version: { increment: 1 },
          },
        });

        return tx.reservation.create({
          data: {
            userId: user.sub,
            pharmacyId: body.pharmacyId,
            productId: body.productId,
            quantity: body.quantity,
            status: "CONFIRMED",
            expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
          },
          select: reservationSelect,
        });
      });

      const dto = toReservation(reservation);
      pharmacyEvents.publish({
        type: "reservation.created",
        pharmacyId: reservation.pharmacyId,
        payload: dto,
      });
      res.status(201).json(dto);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "NOT_FOUND") {
        res.status(404).json({ error: "Inventory not found for pharmacy/product" });
        return;
      }
      if (code === "CONFLICT") {
        res.status(409).json({ error: "Insufficient stock" });
        return;
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
        res.status(400).json({ error: "Invalid pharmacyId or productId" });
        return;
      }
      console.error("createReservation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

reservationsRouter.patch(
  "/:id",
  requireAuth,
  validateBody(reservationUpdateSchema),
  async (req, res) => {
    const user = req.user!;
    const body = req.body as ReservationUpdateInput;

    try {
      const updated = await prisma.$transaction(async (tx) => {
        const existing = await tx.reservation.findUnique({
          where: { id: req.params.id },
          select: reservationSelect,
        });

        if (!existing) {
          throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
        }

        const isOwner = existing.userId === user.sub;
        const isPharmacyOwner =
          user.role === "PHARMACY" && user.pharmacyId === existing.pharmacyId;
        const isAdmin = user.role === "ADMIN";

        if (body.status === "CANCELLED") {
          if (!isOwner && !isPharmacyOwner && !isAdmin) {
            throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
          }
        } else if (body.status === "PICKED_UP") {
          if (!isPharmacyOwner && !isAdmin) {
            throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
          }
        }

        if (existing.status === "CANCELLED" || existing.status === "PICKED_UP" || existing.status === "EXPIRED") {
          throw Object.assign(new Error(`Cannot update reservation in status ${existing.status}`), {
            code: "CONFLICT",
          });
        }

        if (body.status === "CANCELLED" && (existing.status === "CONFIRMED" || existing.status === "PENDING")) {
          const locked = await tx.$queryRaw<InventoryLockRow[]>`
            SELECT id, stock, version
            FROM inventory
            WHERE pharmacy_id = ${existing.pharmacyId}::uuid
              AND product_id = ${existing.productId}::uuid
            FOR UPDATE
          `;

          const item = locked[0];
          if (item) {
            await tx.inventory.update({
              where: { id: item.id },
              data: {
                stock: item.stock + existing.quantity,
                version: { increment: 1 },
              },
            });
          }
        }

        return tx.reservation.update({
          where: { id: existing.id },
          data: { status: body.status },
          select: reservationSelect,
        });
      });

      const dto = toReservation(updated);
      pharmacyEvents.publish({
        type: "reservation.updated",
        pharmacyId: updated.pharmacyId,
        payload: dto,
      });
      res.json(dto);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "NOT_FOUND") {
        res.status(404).json({ error: "Reservation not found" });
        return;
      }
      if (code === "FORBIDDEN") {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      if (code === "CONFLICT") {
        res.status(409).json({ error: (error as Error).message });
        return;
      }
      console.error("updateReservation error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);
