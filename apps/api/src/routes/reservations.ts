import { Router } from "express";
import {
  Prisma,
  type ReservationGroupStatus,
  type ReservationStatus,
} from "@prisma/client";
import { pharmacyEvents } from "../lib/events.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  reservationCreateSchema,
  reservationGroupCancelSchema,
  reservationGroupCreateSchema,
  reservationGroupPickupSchema,
  reservationUpdateSchema,
  type ReservationCreateInput,
  type ReservationGroupCancelInput,
  type ReservationGroupCreateInput,
  type ReservationGroupPickupInput,
  type ReservationUpdateInput,
} from "../schemas/reservation.js";

export const reservationsRouter = Router();

const RESERVATION_TTL_MS = 24 * 60 * 60 * 1000;

const itemSelect = {
  id: true,
  groupId: true,
  userId: true,
  pharmacyId: true,
  productId: true,
  quantity: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  product: { select: { name: true } },
  pharmacy: { select: { name: true } },
  user: { select: { name: true, email: true, phone: true } },
} as const;

const groupSelect = {
  id: true,
  userId: true,
  pharmacyId: true,
  status: true,
  expiresAt: true,
  createdAt: true,
  pharmacy: { select: { name: true } },
  user: { select: { name: true, email: true, phone: true } },
  items: {
    select: itemSelect,
    orderBy: { createdAt: "asc" as const },
  },
} as const;

type InventoryLockRow = {
  id: string;
  stock: number;
  version: number;
};

function toItem(row: {
  id: string;
  groupId: string;
  userId: string;
  pharmacyId: string;
  productId: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: Date;
  createdAt: Date;
  product?: { name: string } | null;
  pharmacy?: { name: string } | null;
  user?: { name: string; email: string; phone: string | null } | null;
}) {
  return {
    id: row.id,
    groupId: row.groupId,
    userId: row.userId,
    pharmacyId: row.pharmacyId,
    productId: row.productId,
    productName: row.product?.name ?? null,
    pharmacyName: row.pharmacy?.name ?? null,
    clientName: row.user?.name ?? null,
    clientEmail: row.user?.email ?? null,
    clientPhone: row.user?.phone ?? null,
    quantity: row.quantity,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

function deriveGroupStatus(itemStatuses: ReservationStatus[]): ReservationGroupStatus {
  if (itemStatuses.length === 0) return "CANCELLED";
  const active = itemStatuses.filter((s) => s === "CONFIRMED" || s === "PENDING");
  const picked = itemStatuses.filter((s) => s === "PICKED_UP");
  const closed = itemStatuses.filter(
    (s) => s === "CANCELLED" || s === "EXPIRED" || s === "NOT_PICKED_UP",
  );

  if (active.length === itemStatuses.length) return "CONFIRMED";
  if (picked.length === itemStatuses.length) return "PICKED_UP";
  if (closed.length === itemStatuses.length) {
    if (itemStatuses.every((s) => s === "EXPIRED")) return "EXPIRED";
    return "CANCELLED";
  }
  if (picked.length > 0) return "PARTIALLY_PICKED_UP";
  if (active.length > 0) return "CONFIRMED";
  return "CANCELLED";
}

function toGroup(row: {
  id: string;
  userId: string;
  pharmacyId: string;
  status: ReservationGroupStatus;
  expiresAt: Date;
  createdAt: Date;
  pharmacy?: { name: string } | null;
  user?: { name: string; email: string; phone: string | null } | null;
  items: Array<Parameters<typeof toItem>[0]>;
}) {
  const items = row.items.map(toItem);
  return {
    id: row.id,
    userId: row.userId,
    pharmacyId: row.pharmacyId,
    pharmacyName: row.pharmacy?.name ?? null,
    clientName: row.user?.name ?? null,
    clientEmail: row.user?.email ?? null,
    clientPhone: row.user?.phone ?? null,
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    itemCount: items.length,
    items,
  };
}

async function restoreStock(
  tx: Prisma.TransactionClient,
  pharmacyId: string,
  productId: string,
  quantity: number,
) {
  const locked = await tx.$queryRaw<InventoryLockRow[]>`
    SELECT id, stock, version
    FROM inventory
    WHERE pharmacy_id = ${pharmacyId}::uuid
      AND product_id = ${productId}::uuid
    FOR UPDATE
  `;
  const item = locked[0];
  if (item) {
    await tx.inventory.update({
      where: { id: item.id },
      data: {
        stock: item.stock + quantity,
        version: { increment: 1 },
      },
    });
  }
}

async function deductStock(
  tx: Prisma.TransactionClient,
  pharmacyId: string,
  productId: string,
  quantity: number,
) {
  const locked = await tx.$queryRaw<InventoryLockRow[]>`
    SELECT id, stock, version
    FROM inventory
    WHERE pharmacy_id = ${pharmacyId}::uuid
      AND product_id = ${productId}::uuid
    FOR UPDATE
  `;
  const item = locked[0];
  if (!item) {
    throw Object.assign(new Error("Inventory not found"), { code: "NOT_FOUND" });
  }
  if (item.stock < quantity) {
    throw Object.assign(new Error("Insufficient stock"), { code: "CONFLICT" });
  }
  await tx.inventory.update({
    where: { id: item.id },
    data: {
      stock: item.stock - quantity,
      version: { increment: 1 },
    },
  });
}

async function refreshGroupStatus(tx: Prisma.TransactionClient, groupId: string) {
  const items = await tx.reservation.findMany({
    where: { groupId },
    select: { status: true },
  });
  const status = deriveGroupStatus(items.map((i) => i.status));
  return tx.reservationGroup.update({
    where: { id: groupId },
    data: { status },
    select: groupSelect,
  });
}

// ── List groups ───────────────────────────────────────────

reservationsRouter.get("/groups", requireAuth, async (req, res) => {
  const user = req.user!;

  try {
    let where: Prisma.ReservationGroupWhereInput;

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

    const rows = await prisma.reservationGroup.findMany({
      where,
      select: groupSelect,
      orderBy: { createdAt: "desc" },
    });

    res.json(rows.map(toGroup));
  } catch (error) {
    console.error("listReservationGroups error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Create group (cart checkout, single pharmacy) ─────────

reservationsRouter.post(
  "/groups",
  requireAuth,
  requireRole("CLIENT"),
  validateBody(reservationGroupCreateSchema),
  async (req, res) => {
    const user = req.user!;
    const body = req.body as ReservationGroupCreateInput;

    const merged = new Map<string, number>();
    for (const item of body.items) {
      merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
    }
    const items = [...merged.entries()].map(([productId, quantity]) => ({
      productId,
      quantity,
    }));

    try {
      const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);

      const group = await prisma.$transaction(async (tx) => {
        for (const item of items) {
          await deductStock(tx, body.pharmacyId, item.productId, item.quantity);
        }

        return tx.reservationGroup.create({
          data: {
            userId: user.sub,
            pharmacyId: body.pharmacyId,
            status: "CONFIRMED",
            expiresAt,
            items: {
              create: items.map((item) => ({
                userId: user.sub,
                pharmacyId: body.pharmacyId,
                productId: item.productId,
                quantity: item.quantity,
                status: "CONFIRMED",
                expiresAt,
              })),
            },
          },
          select: groupSelect,
        });
      });

      const dto = toGroup(group);
      pharmacyEvents.publish({
        type: "reservation.created",
        pharmacyId: group.pharmacyId,
        payload: dto as unknown as Record<string, unknown>,
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
      console.error("createReservationGroup error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── Partial / full pickup ─────────────────────────────────

reservationsRouter.post(
  "/groups/:id/pickup",
  requireAuth,
  requireRole("PHARMACY", "ADMIN"),
  validateBody(reservationGroupPickupSchema),
  async (req, res) => {
    const user = req.user!;
    const body = req.body as ReservationGroupPickupInput;

    try {
      const group = await prisma.$transaction(async (tx) => {
        const existing = await tx.reservationGroup.findUnique({
          where: { id: req.params.id },
          select: {
            id: true,
            pharmacyId: true,
            status: true,
            items: { select: { id: true, status: true } },
          },
        });

        if (!existing) {
          throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
        }

        if (user.role === "PHARMACY" && user.pharmacyId !== existing.pharmacyId) {
          throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
        }

        const targetIds = body.all
          ? existing.items
              .filter((i) => i.status === "CONFIRMED" || i.status === "PENDING")
              .map((i) => i.id)
          : (body.itemIds ?? []);

        if (targetIds.length === 0) {
          throw Object.assign(new Error("No active items to pick up"), { code: "CONFLICT" });
        }

        const notPickedIds = body.all
          ? existing.items
              .filter(
                (i) =>
                  (i.status === "CONFIRMED" || i.status === "PENDING") &&
                  !targetIds.includes(i.id),
              )
              .map((i) => i.id)
          : existing.items
              .filter(
                (i) =>
                  (i.status === "CONFIRMED" || i.status === "PENDING") &&
                  !(body.itemIds ?? []).includes(i.id),
              )
              .map((i) => i.id);

        // When all=true, only mark selected as picked; remaining active stay.
        // When partial selection without all, mark selected PICKED_UP and rest active as NOT_PICKED_UP + restore stock.
        const markNotPicked = body.all !== true;

        for (const itemId of targetIds) {
          const item = existing.items.find((i) => i.id === itemId);
          if (!item || (item.status !== "CONFIRMED" && item.status !== "PENDING")) {
            throw Object.assign(new Error("Invalid item for pickup"), { code: "CONFLICT" });
          }
          await tx.reservation.update({
            where: { id: itemId },
            data: { status: "PICKED_UP" },
          });
        }

        if (markNotPicked) {
          for (const itemId of notPickedIds) {
            const full = await tx.reservation.findUnique({
              where: { id: itemId },
              select: {
                id: true,
                pharmacyId: true,
                productId: true,
                quantity: true,
                status: true,
              },
            });
            if (!full || (full.status !== "CONFIRMED" && full.status !== "PENDING")) continue;
            await restoreStock(tx, full.pharmacyId, full.productId, full.quantity);
            await tx.reservation.update({
              where: { id: itemId },
              data: { status: "NOT_PICKED_UP" },
            });
          }
        }

        return refreshGroupStatus(tx, existing.id);
      });

      const dto = toGroup(group);
      pharmacyEvents.publish({
        type: "reservation.updated",
        pharmacyId: group.pharmacyId,
        payload: dto as unknown as Record<string, unknown>,
      });
      res.json(dto);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "NOT_FOUND") {
        res.status(404).json({ error: "Reservation group not found" });
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
      console.error("pickupReservationGroup error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── Cancel group or items ─────────────────────────────────

reservationsRouter.post(
  "/groups/:id/cancel",
  requireAuth,
  validateBody(reservationGroupCancelSchema),
  async (req, res) => {
    const user = req.user!;
    const body = req.body as ReservationGroupCancelInput;

    try {
      const group = await prisma.$transaction(async (tx) => {
        const existing = await tx.reservationGroup.findUnique({
          where: { id: req.params.id },
          select: {
            id: true,
            userId: true,
            pharmacyId: true,
            items: {
              select: {
                id: true,
                status: true,
                pharmacyId: true,
                productId: true,
                quantity: true,
              },
            },
          },
        });

        if (!existing) {
          throw Object.assign(new Error("Not found"), { code: "NOT_FOUND" });
        }

        const isOwner = existing.userId === user.sub;
        const isPharmacyOwner =
          user.role === "PHARMACY" && user.pharmacyId === existing.pharmacyId;
        const isAdmin = user.role === "ADMIN";

        if (!isOwner && !isPharmacyOwner && !isAdmin) {
          throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
        }

        const targetIds = body.all
          ? existing.items
              .filter((i) => i.status === "CONFIRMED" || i.status === "PENDING")
              .map((i) => i.id)
          : (body.itemIds ?? []);

        if (targetIds.length === 0) {
          throw Object.assign(new Error("No active items to cancel"), { code: "CONFLICT" });
        }

        for (const itemId of targetIds) {
          const item = existing.items.find((i) => i.id === itemId);
          if (!item || (item.status !== "CONFIRMED" && item.status !== "PENDING")) {
            throw Object.assign(new Error("Invalid item for cancel"), { code: "CONFLICT" });
          }
          await restoreStock(tx, item.pharmacyId, item.productId, item.quantity);
          await tx.reservation.update({
            where: { id: itemId },
            data: { status: "CANCELLED" },
          });
        }

        return refreshGroupStatus(tx, existing.id);
      });

      const dto = toGroup(group);
      pharmacyEvents.publish({
        type: "reservation.updated",
        pharmacyId: group.pharmacyId,
        payload: dto as unknown as Record<string, unknown>,
      });
      res.json(dto);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "NOT_FOUND") {
        res.status(404).json({ error: "Reservation group not found" });
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
      console.error("cancelReservationGroup error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// ── Legacy list (flat items) ──────────────────────────────

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
      select: itemSelect,
      orderBy: { createdAt: "desc" },
    });

    res.json(rows.map(toItem));
  } catch (error) {
    console.error("listReservations error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Legacy single-item create (wraps as 1-item group) ─────

reservationsRouter.post(
  "/",
  requireAuth,
  requireRole("CLIENT"),
  validateBody(reservationCreateSchema),
  async (req, res) => {
    const user = req.user!;
    const body = req.body as ReservationCreateInput;

    try {
      const expiresAt = new Date(Date.now() + RESERVATION_TTL_MS);

      const group = await prisma.$transaction(async (tx) => {
        await deductStock(tx, body.pharmacyId, body.productId, body.quantity);

        return tx.reservationGroup.create({
          data: {
            userId: user.sub,
            pharmacyId: body.pharmacyId,
            status: "CONFIRMED",
            expiresAt,
            items: {
              create: {
                userId: user.sub,
                pharmacyId: body.pharmacyId,
                productId: body.productId,
                quantity: body.quantity,
                status: "CONFIRMED",
                expiresAt,
              },
            },
          },
          select: groupSelect,
        });
      });

      const dto = toGroup(group);
      pharmacyEvents.publish({
        type: "reservation.created",
        pharmacyId: group.pharmacyId,
        payload: dto as unknown as Record<string, unknown>,
      });

      const item = dto.items[0];
      res.status(201).json(item ?? dto);
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

// ── Legacy item patch ─────────────────────────────────────

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
          select: itemSelect,
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
        } else if (body.status === "PICKED_UP" || body.status === "NOT_PICKED_UP") {
          if (!isPharmacyOwner && !isAdmin) {
            throw Object.assign(new Error("Forbidden"), { code: "FORBIDDEN" });
          }
        }

        if (
          existing.status === "CANCELLED" ||
          existing.status === "PICKED_UP" ||
          existing.status === "EXPIRED" ||
          existing.status === "NOT_PICKED_UP"
        ) {
          throw Object.assign(new Error(`Cannot update reservation in status ${existing.status}`), {
            code: "CONFLICT",
          });
        }

        if (
          (body.status === "CANCELLED" || body.status === "NOT_PICKED_UP") &&
          (existing.status === "CONFIRMED" || existing.status === "PENDING")
        ) {
          await restoreStock(tx, existing.pharmacyId, existing.productId, existing.quantity);
        }

        const item = await tx.reservation.update({
          where: { id: existing.id },
          data: { status: body.status },
          select: itemSelect,
        });

        await refreshGroupStatus(tx, existing.groupId);
        return item;
      });

      const dto = toItem(updated);
      pharmacyEvents.publish({
        type: "reservation.updated",
        pharmacyId: updated.pharmacyId,
        payload: dto as unknown as Record<string, unknown>,
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
