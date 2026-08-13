import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import { AdminPharmaciesPage } from "./pages/AdminPharmaciesPage";
import { HomePage } from "./pages/HomePage";
import { InventoryPage } from "./pages/InventoryPage";
import { LivePage } from "./pages/LivePage";
import { LoginPage } from "./pages/LoginPage";
import { PharmaciesPage } from "./pages/PharmaciesPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ReservationsPage } from "./pages/ReservationsPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="pharmacies" element={<PharmaciesPage />} />
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
            <Route
              path="reservations"
              element={
                <ProtectedRoute>
                  <ReservationsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="inventory"
              element={
                <ProtectedRoute roles={["PHARMACY", "ADMIN"]}>
                  <InventoryPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="live"
              element={
                <ProtectedRoute roles={["PHARMACY"]}>
                  <LivePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="admin/pharmacies"
              element={
                <ProtectedRoute roles={["ADMIN"]}>
                  <AdminPharmaciesPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
