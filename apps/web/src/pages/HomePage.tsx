import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { SearchMap } from "../components/SearchMap";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { ApiError, api } from "../lib/api";
import type { Pharmacy, SearchResultRow } from "../types";

export function HomePage() {
  const { user, isAuthenticated } = useAuth();
  const { addItem } = useCart();
  const [q, setQ] = useState("");
  const [cp, setCp] = useState("");
  const [pharmacyId, setPharmacyId] = useState("");
  const [sort, setSort] = useState<"price_asc" | "price_desc">("price_asc");
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [rows, setRows] = useState<SearchResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "map">("table");

  useEffect(() => {
    void api
      .listPharmacies()
      .then(setPharmacies)
      .catch(() => setPharmacies([]));
  }, []);

  async function onSearch(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const data = await api.search({
        q: q.trim() || undefined,
        cp: cp.trim() || undefined,
        pharmacyId: pharmacyId || undefined,
        sort,
      });
      setRows(data);
      if (data.length === 0) setMessage("Sin resultados para esa búsqueda.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al buscar");
    } finally {
      setLoading(false);
    }
  }

  function addToCart(row: SearchResultRow) {
    if (!isAuthenticated || user?.role !== "CLIENT") {
      setError("Debes iniciar sesión como CLIENT para añadir al carrito.");
      return;
    }
    setError(null);
    addItem(row, 1);
    setMessage(`Añadido al carrito: ${row.productName} (${row.pharmacyName}).`);
  }

  const canCart = isAuthenticated && user?.role === "CLIENT";

  return (
    <section className="stack">
      <div className="hero">
        <div>
          <p className="eyebrow">ROPO · Research Online, Purchase Offline</p>
          <h1>Compara stock y precios de farmacias locales</h1>
          <p className="muted">
            Busca por producto, farmacia o CP. Ordena por precio y reserva el conjunto para recoger
            en tienda.
          </p>
        </div>
        {!isAuthenticated && (
          <div className="hero-actions">
            <Link className="btn" to="/login">
              Entrar
            </Link>
            <Link className="btn ghost" to="/register">
              Crear cuenta
            </Link>
          </div>
        )}
      </div>

      <form className="card filters filters-extended" onSubmit={onSearch}>
        <label>
          Producto
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ej. paracetamol, vitamina... (vacío = todos)"
          />
        </label>
        <label>
          Farmacia
          <select value={pharmacyId} onChange={(e) => setPharmacyId(e.target.value)}>
            <option value="">Todas las farmacias</option>
            {pharmacies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.cp})
              </option>
            ))}
          </select>
        </label>
        <label>
          Código postal
          <input value={cp} onChange={(e) => setCp(e.target.value)} placeholder="28013" />
        </label>
        <label>
          Orden precio
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as "price_asc" | "price_desc")}
          >
            <option value="price_asc">Menor a mayor</option>
            <option value="price_desc">Mayor a menor</option>
          </select>
        </label>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Buscando..." : "Comparar"}
        </button>
      </form>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert ok">{message}</div>}

      {rows.length > 0 && (
        <div className="view-toggle">
          <button
            type="button"
            className={`btn small ${view === "table" ? "" : "ghost"}`}
            onClick={() => setView("table")}
          >
            Tabla
          </button>
          <button
            type="button"
            className={`btn small ${view === "map" ? "" : "ghost"}`}
            onClick={() => setView("map")}
          >
            Mapa
          </button>
        </div>
      )}

      {view === "map" && rows.length > 0 ? (
        <SearchMap rows={rows} canReserve={canCart} onReserve={addToCart} />
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Producto</th>
                <th>Farmacia</th>
                <th>CP</th>
                <th>Stock</th>
                <th>Precio</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.pharmacyId}-${row.productId}`}>
                  <td>{row.productName}</td>
                  <td>{row.pharmacyName}</td>
                  <td>{row.cp}</td>
                  <td>
                    <span className={row.stock > 0 ? "badge ok" : "badge warn"}>{row.stock}</span>
                  </td>
                  <td>{row.price.toFixed(2)} €</td>
                  <td>
                    <button
                      type="button"
                      className="btn small"
                      disabled={row.stock < 1 || !canCart}
                      onClick={() => addToCart(row)}
                    >
                      Al carrito
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="muted center">
                    Ejecuta una búsqueda para ver resultados. Elige una farmacia sin producto para
                    ver todo su catálogo.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
