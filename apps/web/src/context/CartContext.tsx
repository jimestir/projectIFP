import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CartItem, SearchResultRow } from "../types";

const STORAGE_KEY = "stockpymes.cart.v1";

type CartContextValue = {
  items: CartItem[];
  count: number;
  addItem: (row: SearchResultRow, quantity?: number) => void;
  setQuantity: (pharmacyId: string, productId: string, quantity: number) => void;
  removeItem: (pharmacyId: string, productId: string) => void;
  clearPharmacy: (pharmacyId: string) => void;
  clearAll: () => void;
  byPharmacy: Map<string, CartItem[]>;
};

const CartContext = createContext<CartContextValue | null>(null);

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => loadCart());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const addItem = useCallback((row: SearchResultRow, quantity = 1) => {
    setItems((prev) => {
      const idx = prev.findIndex(
        (i) => i.pharmacyId === row.pharmacyId && i.productId === row.productId,
      );
      if (idx >= 0) {
        const next = [...prev];
        const current = next[idx];
        const qty = Math.min(row.stock, current.quantity + quantity);
        next[idx] = { ...current, quantity: qty, stock: row.stock, price: row.price };
        return next;
      }
      return [
        ...prev,
        {
          pharmacyId: row.pharmacyId,
          pharmacyName: row.pharmacyName,
          productId: row.productId,
          productName: row.productName,
          price: row.price,
          stock: row.stock,
          quantity: Math.min(row.stock, Math.max(1, quantity)),
          cp: row.cp,
        },
      ];
    });
  }, []);

  const setQuantity = useCallback((pharmacyId: string, productId: string, quantity: number) => {
    setItems((prev) =>
      prev
        .map((i) => {
          if (i.pharmacyId !== pharmacyId || i.productId !== productId) return i;
          const qty = Math.max(0, Math.min(i.stock, Math.floor(quantity)));
          return { ...i, quantity: qty };
        })
        .filter((i) => i.quantity > 0),
    );
  }, []);

  const removeItem = useCallback((pharmacyId: string, productId: string) => {
    setItems((prev) =>
      prev.filter((i) => !(i.pharmacyId === pharmacyId && i.productId === productId)),
    );
  }, []);

  const clearPharmacy = useCallback((pharmacyId: string) => {
    setItems((prev) => prev.filter((i) => i.pharmacyId !== pharmacyId));
  }, []);

  const clearAll = useCallback(() => setItems([]), []);

  const byPharmacy = useMemo(() => {
    const map = new Map<string, CartItem[]>();
    for (const item of items) {
      const list = map.get(item.pharmacyId) ?? [];
      list.push(item);
      map.set(item.pharmacyId, list);
    }
    return map;
  }, [items]);

  const value = useMemo(
    () => ({
      items,
      count: items.reduce((s, i) => s + i.quantity, 0),
      addItem,
      setQuantity,
      removeItem,
      clearPharmacy,
      clearAll,
      byPharmacy,
    }),
    [items, addItem, setQuantity, removeItem, clearPharmacy, clearAll, byPharmacy],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
