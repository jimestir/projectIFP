import { Router } from "express";
import { prisma } from "../lib/prisma.js";

export const productsRouter = Router();

const productSelect = {
  id: true,
  name: true,
  description: true,
  categoryId: true,
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

productsRouter.get("/", async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : undefined;
    const categoryId =
      typeof req.query.categoryId === "string" ? req.query.categoryId.trim() : undefined;

    if (categoryId && !UUID_RE.test(categoryId)) {
      res.status(400).json({ error: "categoryId must be a valid UUID" });
      return;
    }

    const products = await prisma.product.findMany({
      where: {
        AND: [
          q
            ? {
                name: {
                  contains: q,
                  mode: "insensitive",
                },
              }
            : {},
          categoryId ? { categoryId } : {},
        ],
      },
      select: productSelect,
      orderBy: { name: "asc" },
    });

    res.json(products);
  } catch (error) {
    console.error("listProducts error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
