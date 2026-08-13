import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export const searchRouter = Router();

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

searchRouter.get("/", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const cp = typeof req.query.cp === "string" ? req.query.cp.trim() : undefined;
    const categoryId =
      typeof req.query.categoryId === "string" ? req.query.categoryId.trim() : undefined;

    if (categoryId && !UUID_RE.test(categoryId)) {
      res.status(400).json({ error: "categoryId must be a valid UUID" });
      return;
    }

    const rows = await prisma.inventory.findMany({
      where: {
        AND: [
          q
            ? {
                product: {
                  name: {
                    contains: q,
                    mode: "insensitive",
                  },
                },
              }
            : {},
          categoryId
            ? {
                product: {
                  categoryId,
                },
              }
            : {},
          cp
            ? {
                pharmacy: {
                  cp,
                },
              }
            : {},
        ],
      },
      select: {
        stock: true,
        price: true,
        product: {
          select: {
            id: true,
            name: true,
          },
        },
        pharmacy: {
          select: {
            id: true,
            name: true,
            cp: true,
            lat: true,
            lng: true,
          },
        },
      },
      orderBy: [{ price: "asc" }, { stock: "desc" }],
    });

    const result = rows.map((row: {
      stock: number;
      price: Prisma.Decimal;
      product: { id: string; name: string };
      pharmacy: {
        id: string;
        name: string;
        cp: string;
        lat: number | null;
        lng: number | null;
      };
    }) => ({
      productId: row.product.id,
      productName: row.product.name,
      pharmacyId: row.pharmacy.id,
      pharmacyName: row.pharmacy.name,
      cp: row.pharmacy.cp,
      stock: row.stock,
      price: Number(row.price),
      lat: row.pharmacy.lat,
      lng: row.pharmacy.lng,
    }));

    res.json(result);
  } catch (error) {
    console.error("searchCompare error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
