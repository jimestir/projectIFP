import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";
import type { Reservation } from "../types";

export function ReservationsPage() {
  const { token, user } = useAuth();
  const [items, setItems] = useState<Reservation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setItems(await api.listReservations(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error cargando reservas");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: "CANCELLED" | "PICKED_UP") {
    if (!token) return;
    setError(null);
    setMessage(null);
    try {
      await api.updateReservation(token, id, status);
      setMessage(`Reserva actualizada a ${status}`);
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo actualizar");
    }
  }

  return (
    <section className="stack">
      <h1>Reservas</h1>
      <p className="muted">
        {user?.role === "PHARMACY"
          ? "Reservas recibidas en tu farmacia."
          : "Tus reservas ROPO."}
      </p>
      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert ok">{message}</div>}
      {loading ? (
        <p className="muted">Cargando...</p>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Producto</th>
                <th>Cant.</th>
                <th>Estado</th>
                <th>Expira</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.id}>
                  <td className="mono">{r.id.slice(0, 8)}…</td>
                  <td className="mono">{r.productId.slice(0, 8)}…</td>
                  <td>{r.quantity}</td>
                  <td>
                    <span className="badge">{r.status}</span>
                  </td>
                  <td>{new Date(r.expiresAt).toLocaleString()}</td>
                  <td className="row-actions">
                    {(user?.role === "CLIENT" || user?.role === "PHARMACY" || user?.role === "ADMIN") &&
                      (r.status === "CONFIRMED" || r.status === "PENDING") && (
                        <button
                          type="button"
                          className="btn small ghost"
                          onClick={() => updateStatus(r.id, "CANCELLED")}
                        >
                          Cancelar
                        </button>
                      )}
                    {(user?.role === "PHARMACY" || user?.role === "ADMIN") &&
                      (r.status === "CONFIRMED" || r.status === "PENDING") && (
                        <button
                          type="button"
                          className="btn small"
                          onClick={() => updateStatus(r.id, "PICKED_UP")}
                        >
                          Retirada
                        </button>
                      )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted center">
                    No hay reservas todavía.
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
