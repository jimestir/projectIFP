import { z } from "zod";

export const reservationCreateSchema = z.object({
  pharmacyId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
});

export const reservationGroupCreateSchema = z.object({
  pharmacyId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().min(1),
      }),
    )
    .min(1)
    .max(50),
});

export const reservationUpdateSchema = z.object({
  status: z.enum(["CANCELLED", "PICKED_UP", "NOT_PICKED_UP"]),
});

export const reservationGroupPickupSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1).optional(),
  all: z.boolean().optional(),
}).refine((v) => v.all === true || (v.itemIds && v.itemIds.length > 0), {
  message: "Provide all=true or itemIds",
});

export const reservationGroupCancelSchema = z.object({
  itemIds: z.array(z.string().uuid()).min(1).optional(),
  all: z.boolean().optional(),
}).refine((v) => v.all === true || (v.itemIds && v.itemIds.length > 0), {
  message: "Provide all=true or itemIds",
});

export type ReservationCreateInput = z.infer<typeof reservationCreateSchema>;
export type ReservationGroupCreateInput = z.infer<typeof reservationGroupCreateSchema>;
export type ReservationUpdateInput = z.infer<typeof reservationUpdateSchema>;
export type ReservationGroupPickupInput = z.infer<typeof reservationGroupPickupSchema>;
export type ReservationGroupCancelInput = z.infer<typeof reservationGroupCancelSchema>;
