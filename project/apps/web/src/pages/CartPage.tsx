import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { ApiError, api } from "../lib/api";

export function CartPage() {
  const { token, user, isAuthenticated } = useAuth();
  const { byPharmacy, setQuantity, removeItem, clearPharmacy, count } = useCart();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busyPharmacy, setBusyPharmacy] = useState<string | null>(null);
  const navigate = useNavigate();

  if (!isAuthenticated || user?.role !== "CLIENT") {
    return (
      <section className="stack">
        <h1>Carrito</h1>
        <p className="muted">Debes iniciar sesión como cliente para usar el carrito.</p>
        <Link className="btn" to="/login">
          Entrar
        </Link>
      </section>
    );
  }

  async function checkout(pharmacyId: string) {
    if (!token) return;
    const list = byPharmacy.get(pharmacyId) ?? [];
    if (list.length === 0) return;

    setError(null);
    setMessage(null);
    setBusyPharmacy(pharmacyId);
    try {
      const group = await api.createReservationGroup(token, {
        pharmacyId,
        items: list.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      });
      clearPharmacy(pharmacyId);
      setMessage(
        `Reserva creada en ${group.pharmacyName ?? "farmacia"} (${group.itemCount} artículo${group.itemCount === 1 ? "" : "s"}).`,
      );
      navigate("/reservations");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la reserva");
    } finally {
      setBusyPharmacy(null);
    }
  }

  return (
    <section className="stack">
      <h1>Carrito</h1>
      <p className="muted">
        Ajusta cantidades y reserva por farmacia. Cada farmacia genera un conjunto de recogida.
      </p>
      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert ok">{message}</div>}

      {count === 0 ? (
        <div className="card">
          <p className="muted center">El carrito está vacío.</p>
          <p className="center">
            <Link to="/">Ir al comparador</Link>
          </p>
        </div>
      ) : (
        [...byPharmacy.entries()].map(([pharmacyId, list]) => {
          const name = list[0]?.pharmacyName ?? pharmacyId.slice(0, 8);
          const total = list.reduce((s, i) => s + i.price * i.quantity, 0);
          return (
            <div key={pharmacyId} className="card stack">
              <div className="cart-group-head">
                <div>
                  <h2>{name}</h2>
                  <p className="muted">{list.length} producto{list.length === 1 ? "" : "s"}</p>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn ghost small"
                    onClick={() => clearPharmacy(pharmacyId)}
                  >
                    Vaciar
                  </button>
                  <button
                    type="button"
                    className="btn"
                    disabled={busyPharmacy === pharmacyId}
                    onClick={() => checkout(pharmacyId)}
                  >
                    {busyPharmacy === pharmacyId ? "Reservando..." : "Reservar conjunto"}
                  </button>
                </div>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th>Precio</th>
                      <th>Cant.</th>
                      <th>Subtotal</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((item) => (
                      <tr key={`${item.pharmacyId}-${item.productId}`}>
                        <td>{item.productName}</td>
                        <td>{item.price.toFixed(2)} €</td>
                        <td>
                          <input
                            className="qty-input"
                            type="number"
                            min={1}
                            max={item.stock}
                            value={item.quantity}
                            onChange={(e) =>
                              setQuantity(
                                item.pharmacyId,
                                item.productId,
                                Number(e.target.value) || 0,
                              )
                            }
                          />
                          <span className="muted qty-stock">/ {item.stock}</span>
                        </td>
                        <td>{(item.price * item.quantity).toFixed(2)} €</td>
                        <td>
                          <button
                            type="button"
                            className="btn small ghost danger-text"
                            onClick={() => removeItem(item.pharmacyId, item.productId)}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="cart-total">
                Total estimado: <strong>{total.toFixed(2)} €</strong>
              </p>
            </div>
          );
        })
      )}
    </section>
  );
}
