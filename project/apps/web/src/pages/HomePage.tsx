import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { SearchMap } from "../components/SearchMap";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";
import type { SearchResultRow } from "../types";

export function HomePage() {
  const { token, user, isAuthenticated } = useAuth();
  const [q, setQ] = useState("paracetamol");
  const [cp, setCp] = useState("");
  const [rows, setRows] = useState<SearchResultRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [view, setView] = useState<"table" | "map">("table");

  async function onSearch(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const data = await api.search({
        q: q.trim() || undefined,
        cp: cp.trim() || undefined,
      });
      setRows(data);
      if (data.length === 0) setMessage("Sin resultados para esa búsqueda.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error al buscar");
    } finally {
      setLoading(false);
    }
  }

  async function reserve(row: SearchResultRow) {
    if (!token || user?.role !== "CLIENT") {
      setError("Debes iniciar sesión como CLIENT para reservar.");
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const reservation = await api.createReservation(token, {
        pharmacyId: row.pharmacyId,
        productId: row.productId,
        quantity: 1,
      });
      setMessage(
        `Reserva creada (${reservation.status})${
          reservation.productName ? `: ${reservation.productName}` : ""
        }.`,
      );
      await onSearch();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo reservar");
    }
  }

  const canReserve = isAuthenticated && user?.role === "CLIENT";

  return (
    <section className="stack">
      <div className="hero">
        <div>
          <p className="eyebrow">ROPO · Research Online, Purchase Offline</p>
          <h1>Compara stock y precios de farmacias locales</h1>
          <p className="muted">
            Busca un producto, filtra por código postal, mira el mapa y reserva para recoger en tienda.
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

      <form className="card filters" onSubmit={onSearch}>
        <label>
          Producto
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ej. paracetamol, vitamina..."
          />
        </label>
        <label>
          Código postal
          <input value={cp} onChange={(e) => setCp(e.target.value)} placeholder="28013" />
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
        <SearchMap rows={rows} canReserve={canReserve} onReserve={reserve} />
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
                    <span className={row.stock > 0 ? "badge ok" : "badge warn"}>
                      {row.stock}
                    </span>
                  </td>
                  <td>{row.price.toFixed(2)} €</td>
                  <td>
                    <button
                      type="button"
                      className="btn small"
                      disabled={row.stock < 1 || !canReserve}
                      onClick={() => reserve(row)}
                    >
                      Reservar
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="muted center">
                    Ejecuta una búsqueda para ver resultados.
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
