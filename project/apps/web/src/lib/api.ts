import type {
  AuthResponse,
  InventoryItem,
  Pharmacy,
  Product,
  Reservation,
  SearchResultRow,
  UserPublic,
} from "../types";

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ?? "";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : null;

  if (!res.ok) {
    const err = data as { error?: string; details?: unknown } | null;
    throw new ApiError(res.status, err?.error ?? `HTTP ${res.status}`, err?.details);
  }

  return data as T;
}

export const api = {
  health: () =>
    request<{ status: string; service: string; database: string; timestamp: string }>("/api/health"),

  login: (email: string, password: string) =>
    request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: { email, password },
    }),

  register: (body: {
    email: string;
    password: string;
    name: string;
    role: "CLIENT" | "PHARMACY";
    phone?: string;
    pharmacyId?: string;
  }) =>
    request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body,
    }),

  listPharmacies: (cp?: string) =>
    request<Pharmacy[]>(`/api/pharmacies${cp ? `?cp=${encodeURIComponent(cp)}` : ""}`),

  listProducts: (q?: string) =>
    request<Product[]>(`/api/products${q ? `?q=${encodeURIComponent(q)}` : ""}`),

  search: (params: { q?: string; cp?: string; categoryId?: string }) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.cp) qs.set("cp", params.cp);
    if (params.categoryId) qs.set("categoryId", params.categoryId);
    const query = qs.toString();
    return request<SearchResultRow[]>(`/api/search${query ? `?${query}` : ""}`);
  },

  listInventory: (token: string) =>
    request<InventoryItem[]>("/api/inventory", { token }),

  upsertInventory: (
    token: string,
    body: { productId: string; stock: number; price: number },
  ) =>
    request<InventoryItem>("/api/inventory", {
      method: "PUT",
      token,
      body,
    }),

  listReservations: (token: string) =>
    request<Reservation[]>("/api/reservations", { token }),

  createReservation: (
    token: string,
    body: { pharmacyId: string; productId: string; quantity: number },
  ) =>
    request<Reservation>("/api/reservations", {
      method: "POST",
      token,
      body,
    }),

  updateReservation: (token: string, id: string, status: "CANCELLED" | "PICKED_UP") =>
    request<Reservation>(`/api/reservations/${id}`, {
      method: "PATCH",
      token,
      body: { status },
    }),
};

export type { UserPublic };
