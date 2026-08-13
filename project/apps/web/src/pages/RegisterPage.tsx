import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { ApiError, api } from "../lib/api";
import type { Pharmacy } from "../types";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("Password123!");
  const [role, setRole] = useState<"CLIENT" | "PHARMACY">("CLIENT");
  const [pharmacyId, setPharmacyId] = useState("");
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api
      .listPharmacies()
      .then(setPharmacies)
      .catch(() => setPharmacies([]));
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register({
        name,
        email,
        password,
        role,
        pharmacyId: role === "PHARMACY" ? pharmacyId : undefined,
      });
      navigate(role === "PHARMACY" ? "/inventory" : "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="auth-page">
      <form className="card auth-card" onSubmit={onSubmit}>
        <h1>Crear cuenta</h1>
        {error && <div className="alert error">{error}</div>}
        <label>
          Nombre
          <input required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label>
          Rol
          <select value={role} onChange={(e) => setRole(e.target.value as "CLIENT" | "PHARMACY")}>
            <option value="CLIENT">Cliente</option>
            <option value="PHARMACY">Farmacia</option>
          </select>
        </label>
        {role === "PHARMACY" && (
          <label>
            Farmacia
            <select
              required
              value={pharmacyId}
              onChange={(e) => setPharmacyId(e.target.value)}
            >
              <option value="">Selecciona farmacia</option>
              {pharmacies.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.cp})
                </option>
              ))}
            </select>
          </label>
        )}
        <button className="btn" type="submit" disabled={loading}>
          {loading ? "Creando..." : "Registrarme"}
        </button>
        <p className="muted">
          ¿Ya tienes cuenta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </section>
  );
}
