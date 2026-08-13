import { z } from "zod";

export const reservationCreateSchema = z.object({
  pharmacyId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).default(1),
});

export const reservationUpdateSchema = z.object({
  status: z.enum(["CANCELLED", "PICKED_UP"]),
});

export type ReservationCreateInput = z.infer<typeof reservationCreateSchema>;
export type ReservationUpdateInput = z.infer<typeof reservationUpdateSchema>;
