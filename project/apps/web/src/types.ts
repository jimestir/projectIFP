export type UserRole = "CLIENT" | "PHARMACY" | "ADMIN";

export type ReservationStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CANCELLED"
  | "EXPIRED"
  | "PICKED_UP"
  | "NOT_PICKED_UP";

export type ReservationGroupStatus =
  | "CONFIRMED"
  | "PARTIALLY_PICKED_UP"
  | "PICKED_UP"
  | "CANCELLED"
  | "EXPIRED";

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
  description: string | null;
  address: string;
  cp: string;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  imageUrl: string | null;
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
  groupId?: string;
  userId: string;
  pharmacyId: string;
  productId: string;
  productName?: string | null;
  pharmacyName?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  quantity: number;
  status: ReservationStatus;
  expiresAt: string;
  createdAt: string;
};

export type ReservationGroup = {
  id: string;
  userId: string;
  pharmacyId: string;
  pharmacyName?: string | null;
  clientName?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  status: ReservationGroupStatus;
  expiresAt: string;
  createdAt: string;
  itemCount: number;
  items: Reservation[];
};

export type CartItem = {
  pharmacyId: string;
  pharmacyName: string;
  productId: string;
  productName: string;
  price: number;
  stock: number;
  quantity: number;
  cp?: string;
};
