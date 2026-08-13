import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";
import type { InventoryItem, Product } from "../types";

export function InventoryPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState("");
  const [stock, setStock] = useState(10);
  const [price, setPrice] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [inventory, catalog] = await Promise.all([
        api.listInventory(token),
        api.listProducts(),
      ]);
      setItems(inventory);
      setProducts(catalog);
      if (!productId && catalog[0]) setProductId(catalog[0].id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error cargando inventario");
    } finally {
      setLoading(false);
    }
  }, [token, productId]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError(null);
    setMessage(null);
    try {
      await api.upsertInventory(token, { productId, stock, price });
      setMessage("Inventario actualizado");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    }
  }

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  return (
    <section className="stack">
      <h1>Inventario de farmacia</h1>
      <p className="muted">Actualiza stock y precio de tus productos.</p>
      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert ok">{message}</div>}

      <form className="card filters" onSubmit={onSubmit}>
        <label>
          Producto
          <select required value={productId} onChange={(e) => setProductId(e.target.value)}>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Stock
          <input
            type="number"
            min={0}
            required
            value={stock}
            onChange={(e) => setStock(Number(e.target.value))}
          />
        </label>
        <label>
          Precio (€)
          <input
            type="number"
            min={0}
            step="0.01"
            required
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
          />
        </label>
        <button className="btn" type="submit">
          Guardar
        </button>
      </form>

      {loading ? (
        <p className="muted">Cargando...</p>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Stock</th>
                <th>Precio</th>
                <th>Versión</th>
                <th>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{productName(item.productId)}</td>
                  <td>{item.stock}</td>
                  <td>{item.price.toFixed(2)} €</td>
                  <td>{item.version}</td>
                  <td>{new Date(item.updatedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
