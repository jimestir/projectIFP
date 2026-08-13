import { Link, NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function Layout() {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          Stock for PYMEs
        </Link>
        <nav className="nav">
          <NavLink to="/">Comparador</NavLink>
          <NavLink to="/pharmacies">Farmacias</NavLink>
          {isAuthenticated && <NavLink to="/reservations">Reservas</NavLink>}
          {user?.role === "PHARMACY" && <NavLink to="/inventory">Inventario</NavLink>}
          {user?.role === "PHARMACY" && <NavLink to="/live">En vivo</NavLink>}
          {user?.role === "ADMIN" && <NavLink to="/admin/pharmacies">Admin</NavLink>}
        </nav>
        <div className="auth-box">
          {isAuthenticated ? (
            <>
              <span className="user-chip">
                {user?.name} · {user?.role}
              </span>
              <button type="button" className="btn ghost" onClick={logout}>
                Salir
              </button>
            </>
          ) : (
            <>
              <NavLink to="/login">Entrar</NavLink>
              <NavLink to="/register" className="btn">
                Registro
              </NavLink>
            </>
          )}
        </div>
      </header>
      <main className="main">
        <Outlet />
      </main>
      <footer className="footer">Equipo 7 · DAW Intermodular · ROPO farmacias</footer>
    </div>
  );
}
