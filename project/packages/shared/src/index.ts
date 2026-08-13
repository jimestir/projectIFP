export type UserRole = "CLIENT" | "PHARMACY" | "ADMIN";

export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "EXPIRED"
  | "PICKED_UP";

export const API_PREFIX = "/api" as const;
