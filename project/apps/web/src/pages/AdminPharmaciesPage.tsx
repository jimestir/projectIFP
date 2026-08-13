import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";
import type { Pharmacy } from "../types";

type PharmacyForm = {
  name: string;
  address: string;
  cp: string;
  lat: string;
  lng: string;
  phone: string;
};

const EMPTY_FORM: PharmacyForm = {
  name: "",
  address: "",
  cp: "",
  lat: "",
  lng: "",
  phone: "",
};

function toForm(p: Pharmacy): PharmacyForm {
  return {
    name: p.name,
    address: p.address,
    cp: p.cp,
    lat: p.lat != null ? String(p.lat) : "",
    lng: p.lng != null ? String(p.lng) : "",
    phone: p.phone ?? "",
  };
}

function toPayload(f: PharmacyForm) {
  return {
    name: f.name.trim(),
    address: f.address.trim(),
    cp: f.cp.trim(),
    lat: f.lat.trim() ? Number(f.lat) : undefined,
    lng: f.lng.trim() ? Number(f.lng) : undefined,
    phone: f.phone.trim() || undefined,
  };
}

export function AdminPharmaciesPage() {
  const { token } = useAuth();
  const [items, setItems] = useState<Pharmacy[]>([]);
  const [form, setForm] = useState<PharmacyForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.listPharmacies());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error cargando farmacias");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setError(null);
  }

  async function handleDelete(id: string) {
    if (!token) return;
    setDeleting(true);
    setError(null);
    setMessage(null);
    try {
      await api.deletePharmacy(token, id);
      setMessage("Farmacia eliminada");
      setConfirmDeleteId(null);
      if (editingId === id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo eliminar");
    } finally {
      setDeleting(false);
    }
  }

  function startEdit(p: Pharmacy) {
    setEditingId(p.id);
    setForm(toForm(p));
    setError(null);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = toPayload(form);
      if (editingId) {
        await api.updatePharmacy(token, editingId, payload);
        setMessage("Farmacia actualizada");
      } else {
        await api.createPharmacy(token, payload);
        setMessage("Farmacia creada");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  }

  function set<K extends keyof PharmacyForm>(key: K, value: PharmacyForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <section className="stack">
      <h1>Admin · Farmacias</h1>
      <p className="muted">Alta y edición de farmacias del sistema.</p>

      {error && <div className="alert error">{error}</div>}
      {message && <div className="alert ok">{message}</div>}

      <form className="card admin-form" onSubmit={onSubmit}>
        <h2>{editingId ? "Editar farmacia" : "Nueva farmacia"}</h2>
        <div className="admin-grid">
          <label>
            Nombre *
            <input
              required
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Farmacia Centro"
            />
          </label>
          <label>
            Dirección *
            <input
              required
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              placeholder="Calle Mayor 12"
            />
          </label>
          <label>
            CP *
            <input
              required
              value={form.cp}
              onChange={(e) => set("cp", e.target.value)}
              placeholder="28013"
            />
          </label>
          <label>
            Latitud
            <input
              type="number"
              step="any"
              value={form.lat}
              onChange={(e) => set("lat", e.target.value)}
              placeholder="40.4168"
            />
          </label>
          <label>
            Longitud
            <input
              type="number"
              step="any"
              value={form.lng}
              onChange={(e) => set("lng", e.target.value)}
              placeholder="-3.7038"
            />
          </label>
          <label>
            Teléfono
            <input
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              placeholder="910000001"
            />
          </label>
        </div>
        <div className="admin-actions">
          <button className="btn" type="submit" disabled={saving}>
            {saving ? "Guardando..." : editingId ? "Actualizar" : "Crear farmacia"}
          </button>
          {editingId && (
            <button type="button" className="btn ghost" onClick={resetForm}>
              Cancelar
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="muted">Cargando...</p>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Dirección</th>
                <th>CP</th>
                <th>Teléfono</th>
                <th>Coordenadas</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => (
                <tr key={p.id} className={editingId === p.id ? "row-active" : ""}>
                  <td>{p.name}</td>
                  <td>{p.address}</td>
                  <td>{p.cp}</td>
                  <td>{p.phone ?? "—"}</td>
                  <td className="mono">
                    {p.lat != null && p.lng != null
                      ? `${p.lat}, ${p.lng}`
                      : "—"}
                  </td>
                  <td className="table-actions">
                    <button
                      type="button"
                      className="btn small ghost"
                      onClick={() => startEdit(p)}
                    >
                      Editar
                    </button>
                    {confirmDeleteId === p.id ? (
                      <span className="confirm-delete">
                        <button
                          type="button"
                          className="btn small danger"
                          disabled={deleting}
                          onClick={() => handleDelete(p.id)}
                        >
                          {deleting ? "..." : "Sí"}
                        </button>
                        <button
                          type="button"
                          className="btn small ghost"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          No
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="btn small ghost danger-text"
                        onClick={() => setConfirmDeleteId(p.id)}
                      >
                        Eliminar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={6} className="muted center">
                    No hay farmacias registradas.
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
