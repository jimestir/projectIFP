import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";
import type { ReservationGroup } from "../types";

export function ReservationsPage() {
  const { token, user } = useAuth();
  const [groups, setGroups] = useState<ReservationGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const showClient = user?.role === "PHARMACY" || user?.role === "ADMIN";
  const canPickup = user?.role === "PHARMACY" || user?.role === "ADMIN";

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      setGroups(await api.listReservationGroups(token));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error cargando reservas");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggleItem(groupId: string, itemId: string) {
    setSelected((prev) => {
      const next = { ...prev };
      const set = new Set(next[groupId] ?? []);
      if (set.has(itemId)) set.delete(itemId);
      else set.add(itemId);
      next[groupId] = set;
      return next;
    });
  }

  function selectAllActive(group: ReservationGroup) {
    const active = group.items
      .filter((i) => i.status === "CONFIRMED" || i.status === "PENDING")
      .map((i) => i.id);
    setSelected((prev) => ({ ...prev, [group.id]: new Set(active) }));
  }

  async function pickupSelected(group: ReservationGroup) {
    if (!token) return;
    const ids = [...(selected[group.id] ?? [])];
    if (ids.length === 0) {
      setError("Selecciona al menos un artículo para marcar como retirado.");
      return;
    }
    setError(null);
    setMessage(null);
    setBusyId(group.id);
    try {
      await api.pickupReservationGroup(token, group.id, { itemIds: ids });
      setMessage("Recogida parcial registrada. Los no seleccionados vuelven al stock.");
      setSelected((prev) => ({ ...prev, [group.id]: new Set() }));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar la recogida");
    } finally {
      setBusyId(null);
    }
  }

  async function pickupAll(group: ReservationGroup) {
    if (!token) return;
    setError(null);
    setMessage(null);
    setBusyId(group.id);
    try {
      await api.pickupReservationGroup(token, group.id, { all: true });
      setMessage("Conjunto marcado como retirado completo.");
      setSelected((prev) => ({ ...prev, [group.id]: new Set() }));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar la recogida");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelGroup(group: ReservationGroup) {
    if (!token) return;
    setError(null);
    setMessage(null);
    setBusyId(group.id);
    try {
      await api.cancelReservationGroup(token, group.id, { all: true });
      setMessage("Reserva cancelada. Stock restaurado.");
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cancelar");
    } finally {
      setBusyId(null);
    }
  }

  async function cancelSelected(group: ReservationGroup) {
    if (!token) return;
    const ids = [...(selected[group.id] ?? [])];
    if (ids.length === 0) {
      setError("Selecciona artículos a cancelar.");
      return;
    }
    setError(null);
    setMessage(null);
    setBusyId(group.id);
    try {
      await api.cancelReservationGroup(token, group.id, { itemIds: ids });
      setMessage("Artículos cancelados. Stock restaurado.");
      setSelected((prev) => ({ ...prev, [group.id]: new Set() }));
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo cancelar");
    } finally {
      setBusyId(null);
    }
  }

  function statusBadge(status: string) {
    const cls =
      status === "CONFIRMED" || status === "PICKED_UP"
        ? "ok"
        : status === "CANCELLED" || status === "EXPIRED" || status === "NOT_PICKED_UP"
          ? "warn"
          : status === "PARTIALLY_PICKED_UP"
            ? "warn"
            : "";
    return <span className={`badge ${cls}`}>{status}</span>;
  }

  return (
    <section className="stack">
      <h1>Reservas</h1>
      <p className="muted">
        {user?.role === "PHARMACY"
          ? "Conjuntos de reserva de tu farmacia. Puedes marcar recogida total o parcial."
          : user?.role === "ADMIN"
            ? "Todas las reservas del sistema (conjuntos por cliente y farmacia)."
            : "Tus conjuntos de reserva ROPO."}
      </p>
      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert ok">{message}</div>}
      {loading ? (
        <p className="muted">Cargando...</p>
      ) : groups.length === 0 ? (
        <div className="card">
          <p className="muted center">No hay reservas todavía.</p>
        </div>
      ) : (
        groups.map((group) => {
          const activeItems = group.items.filter(
            (i) => i.status === "CONFIRMED" || i.status === "PENDING",
          );
          const hasActive = activeItems.length > 0;
          const sel = selected[group.id] ?? new Set();

          return (
            <div key={group.id} className="card stack reservation-group">
              <div className="cart-group-head">
                <div>
                  <h2>{group.pharmacyName ?? group.pharmacyId.slice(0, 8)}</h2>
                  <p className="muted">
                    {statusBadge(group.status)} · {group.itemCount} artículo
                    {group.itemCount === 1 ? "" : "s"} · expira{" "}
                    {new Date(group.expiresAt).toLocaleString()}
                  </p>
                  {showClient && (
                    <p className="client-pickup-info">
                      <strong>{group.clientName ?? "—"}</strong>
                      {group.clientEmail ? ` · ${group.clientEmail}` : ""}
                      {group.clientPhone ? ` · ${group.clientPhone}` : ""}
                    </p>
                  )}
                </div>
                <div className="row-actions">
                  {hasActive && (
                    <button
                      type="button"
                      className="btn small ghost"
                      disabled={busyId === group.id}
                      onClick={() => cancelGroup(group)}
                    >
                      Cancelar todo
                    </button>
                  )}
                  {canPickup && hasActive && (
                    <>
                      <button
                        type="button"
                        className="btn small ghost"
                        onClick={() => selectAllActive(group)}
                      >
                        Seleccionar activos
                      </button>
                      <button
                        type="button"
                        className="btn small ghost"
                        disabled={busyId === group.id || sel.size === 0}
                        onClick={() => pickupSelected(group)}
                      >
                        Retirar selección
                      </button>
                      <button
                        type="button"
                        className="btn small"
                        disabled={busyId === group.id}
                        onClick={() => pickupAll(group)}
                      >
                        Retirar todo
                      </button>
                    </>
                  )}
                  {!canPickup && hasActive && sel.size > 0 && (
                    <button
                      type="button"
                      className="btn small ghost"
                      disabled={busyId === group.id}
                      onClick={() => cancelSelected(group)}
                    >
                      Cancelar selección
                    </button>
                  )}
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      {(canPickup || user?.role === "CLIENT") && hasActive && <th></th>}
                      <th>Producto</th>
                      <th>Cant.</th>
                      <th>Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => {
                      const active = item.status === "CONFIRMED" || item.status === "PENDING";
                      return (
                        <tr key={item.id}>
                          {(canPickup || user?.role === "CLIENT") && hasActive && (
                            <td>
                              {active ? (
                                <input
                                  type="checkbox"
                                  checked={sel.has(item.id)}
                                  onChange={() => toggleItem(group.id, item.id)}
                                  aria-label={`Seleccionar ${item.productName ?? item.id}`}
                                />
                              ) : null}
                            </td>
                          )}
                          <td>{item.productName ?? item.productId.slice(0, 8)}</td>
                          <td>{item.quantity}</td>
                          <td>{statusBadge(item.status)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {canPickup && hasActive && (
                <p className="muted">
                  Recogida parcial: los artículos no seleccionados se marcan como no retirados y
                  vuelven al stock.
                </p>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
