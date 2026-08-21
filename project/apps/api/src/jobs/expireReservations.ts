import { pharmacyEvents } from "../lib/events.js";
import { prisma } from "../lib/prisma.js";

type InventoryLockRow = {
  id: string;
  stock: number;
  version: number;
};

const DEFAULT_INTERVAL_MS = 60_000;

export async function expireReservationsOnce(): Promise<number> {
  const now = new Date();
  const groups = await prisma.reservationGroup.findMany({
    where: {
      status: { in: ["CONFIRMED", "PARTIALLY_PICKED_UP"] },
      expiresAt: { lte: now },
    },
    select: {
      id: true,
      pharmacyId: true,
      expiresAt: true,
      items: {
        where: { status: { in: ["CONFIRMED", "PENDING"] } },
        select: {
          id: true,
          pharmacyId: true,
          productId: true,
          quantity: true,
          status: true,
        },
      },
    },
    take: 50,
  });

  let count = 0;

  for (const group of groups) {
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const current = await tx.reservationGroup.findUnique({
          where: { id: group.id },
          select: {
            id: true,
            pharmacyId: true,
            status: true,
            expiresAt: true,
            items: {
              select: {
                id: true,
                pharmacyId: true,
                productId: true,
                quantity: true,
                status: true,
              },
            },
          },
        });

        if (!current) return null;
        if (current.expiresAt > now) return null;
        if (current.status !== "CONFIRMED" && current.status !== "PARTIALLY_PICKED_UP") {
          return null;
        }

        for (const item of current.items) {
          if (item.status !== "CONFIRMED" && item.status !== "PENDING") continue;

          const locked = await tx.$queryRaw<InventoryLockRow[]>`
            SELECT id, stock, version
            FROM inventory
            WHERE pharmacy_id = ${item.pharmacyId}::uuid
              AND product_id = ${item.productId}::uuid
            FOR UPDATE
          `;
          const inv = locked[0];
          if (inv) {
            await tx.inventory.update({
              where: { id: inv.id },
              data: {
                stock: inv.stock + item.quantity,
                version: { increment: 1 },
              },
            });
          }
          await tx.reservation.update({
            where: { id: item.id },
            data: { status: "EXPIRED" },
          });
        }

        const allItems = await tx.reservation.findMany({
          where: { groupId: current.id },
          select: { status: true },
        });

        let groupStatus: "EXPIRED" | "PICKED_UP" | "PARTIALLY_PICKED_UP" | "CANCELLED" = "EXPIRED";
        const statuses = allItems.map((i) => i.status);
        const picked = statuses.filter((s) => s === "PICKED_UP").length;
        const expired = statuses.filter((s) => s === "EXPIRED").length;
        if (picked === statuses.length) groupStatus = "PICKED_UP";
        else if (picked > 0 && expired > 0) groupStatus = "PARTIALLY_PICKED_UP";
        else if (statuses.every((s) => s === "CANCELLED" || s === "NOT_PICKED_UP" || s === "EXPIRED")) {
          groupStatus = expired === statuses.length ? "EXPIRED" : "CANCELLED";
        }

        return tx.reservationGroup.update({
          where: { id: current.id },
          data: { status: groupStatus },
          select: {
            id: true,
            pharmacyId: true,
            status: true,
            userId: true,
            expiresAt: true,
            createdAt: true,
          },
        });
      });

      if (updated) {
        count += 1;
        pharmacyEvents.publish({
          type: "reservation.updated",
          pharmacyId: updated.pharmacyId,
          payload: {
            id: updated.id,
            groupId: updated.id,
            pharmacyId: updated.pharmacyId,
            userId: updated.userId,
            status: updated.status,
            expiresAt: updated.expiresAt.toISOString(),
            createdAt: updated.createdAt.toISOString(),
          },
        });
      }
    } catch (error) {
      console.error("expireReservations group error:", group.id, error);
    }
  }

  return count;
}

export function startExpireReservationsJob(intervalMs = DEFAULT_INTERVAL_MS) {
  const tick = async () => {
    try {
      const n = await expireReservationsOnce();
      if (n > 0) {
        console.log(`Expired ${n} reservation group(s)`);
      }
    } catch (error) {
      console.error("expireReservations job error:", error);
    }
  };

  void tick();
  const handle = setInterval(() => {
    void tick();
  }, intervalMs);

  if (typeof handle.unref === "function") {
    handle.unref();
  }

  return () => clearInterval(handle);
}
