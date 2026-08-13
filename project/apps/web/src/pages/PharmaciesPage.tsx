import { useEffect, useState, type FormEvent } from "react";
import { ApiError, api } from "../lib/api";
import type { Pharmacy } from "../types";

export function PharmaciesPage() {
  const [cp, setCp] = useState("");
  const [items, setItems] = useState<Pharmacy[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load(filterCp?: string) {
    setLoading(true);
    setError(null);
    try {
      setItems(await api.listPharmacies(filterCp || undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Error cargando farmacias");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void load(cp.trim());
  }

  return (
    <section className="stack">
      <h1>Farmacias</h1>
      <form className="card filters" onSubmit={onSubmit}>
        <label>
          Filtrar por CP
          <input value={cp} onChange={(e) => setCp(e.target.value)} placeholder="28013" />
        </label>
        <button className="btn" type="submit">
          Filtrar
        </button>
      </form>
      {error && <div className="alert error">{error}</div>}
      {loading ? (
        <p className="muted">Cargando...</p>
      ) : (
        <div className="grid">
          {items.map((p) => (
            <article key={p.id} className="card">
              <h2>{p.name}</h2>
              <p>{p.address}</p>
              <p className="muted">
                CP {p.cp}
                {p.phone ? ` · ${p.phone}` : ""}
              </p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
