import { z } from "zod";

export const pharmacyCreateSchema = z.object({
  name: z.string().min(1).max(160),
  address: z.string().min(1).max(240),
  cp: z.string().min(4).max(12),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
  phone: z.string().min(6).max(30).optional(),
});

export const pharmacyUpdateSchema = pharmacyCreateSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  { message: "At least one field is required" },
);

export type PharmacyCreateInput = z.infer<typeof pharmacyCreateSchema>;
export type PharmacyUpdateInput = z.infer<typeof pharmacyUpdateSchema>;
