export type UserRole = "CLIENT" | "PHARMACY" | "ADMIN";

export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "EXPIRED"
  | "PICKED_UP";

export const API_PREFIX = "/api" as const;

export type UserPublic = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  pharmacyId: string | null;
};

export type AuthResponse = {
  token: string;
  user: UserPublic;
};

export type Pharmacy = {
  id: string;
  name: string;
  address: string;
  cp: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
};

export type InventoryItem = {
  id: string;
  pharmacyId: string;
  productId: string;
  stock: number;
  price: number;
  version: number;
  updatedAt: string;
};

export type SearchResultRow = {
  productId: string;
  productName: string;
  pharmacyId: string;
  pharmacyName: string;
  cp: string;
  stock: number;
  price: number;
  lat: number | null;
  lng: number | null;
};

export type Reservation = {
  id: string;
  userId: string;
  pharmacyId: string;
  productId: string;
  productName?: string | null;
  pharmacyName?: string | null;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
};
