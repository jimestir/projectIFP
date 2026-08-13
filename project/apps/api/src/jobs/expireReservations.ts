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
  const expired = await prisma.reservation.findMany({
    where: {
      status: { in: ["CONFIRMED", "PENDING"] },
      expiresAt: { lte: now },
    },
    select: {
      id: true,
      pharmacyId: true,
      productId: true,
      quantity: true,
      userId: true,
      status: true,
      expiresAt: true,
      createdAt: true,
    },
    take: 100,
  });

  let count = 0;

  for (const reservation of expired) {
    try {
      const updated = await prisma.$transaction(async (tx) => {
        const current = await tx.reservation.findUnique({
          where: { id: reservation.id },
          select: {
            id: true,
            pharmacyId: true,
            productId: true,
            quantity: true,
            userId: true,
            status: true,
            expiresAt: true,
            createdAt: true,
          },
        });

        if (!current || (current.status !== "CONFIRMED" && current.status !== "PENDING")) {
          return null;
        }
        if (current.expiresAt > now) {
          return null;
        }

        const locked = await tx.$queryRaw<InventoryLockRow[]>`
          SELECT id, stock, version
          FROM inventory
          WHERE pharmacy_id = ${current.pharmacyId}::uuid
            AND product_id = ${current.productId}::uuid
          FOR UPDATE
        `;

        const item = locked[0];
        if (item) {
          await tx.inventory.update({
            where: { id: item.id },
            data: {
              stock: item.stock + current.quantity,
              version: { increment: 1 },
            },
          });
        }

        return tx.reservation.update({
          where: { id: current.id },
          data: { status: "EXPIRED" },
          select: {
            id: true,
            pharmacyId: true,
            productId: true,
            quantity: true,
            userId: true,
            status: true,
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
            userId: updated.userId,
            pharmacyId: updated.pharmacyId,
            productId: updated.productId,
            quantity: updated.quantity,
            status: updated.status,
            expiresAt: updated.expiresAt.toISOString(),
            createdAt: updated.createdAt.toISOString(),
          },
        });
      }
    } catch (error) {
      console.error("expireReservations item error:", reservation.id, error);
    }
  }

  return count;
}

export function startExpireReservationsJob(intervalMs = DEFAULT_INTERVAL_MS) {
  const tick = async () => {
    try {
      const n = await expireReservationsOnce();
      if (n > 0) {
        console.log(`Expired ${n} reservation(s)`);
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
