import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VehicleListPage } from "./pages/VehicleListPage.tsx";
import { VehicleDetailPage } from "./pages/VehicleDetailPage.tsx";
import { AddVehiclePage } from "./pages/AddVehiclePage.tsx";
import { SettingsPage } from "./pages/SettingsPage.tsx";
import { LoginPage } from "./pages/LoginPage.tsx";
import { SetupPage } from "./pages/SetupPage.tsx";
import { UsersPage } from "./pages/UsersPage.tsx";
import { Layout } from "./components/Layout.tsx";
import { AuthProvider, useAuth } from "./context/AuthContext.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

function RequireAuth() {
  const { user, loading, setupNeeded } = useAuth();
  if (loading) return null;
  if (setupNeeded) return <Navigate to="/setup" replace />;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function RequireAdmin() {
  const { user } = useAuth();
  if (user?.role !== "admin") return <Navigate to="/vehicles" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/setup" element={<SetupPage />} />

            <Route element={<RequireAuth />}>
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/vehicles" replace />} />
                <Route path="/vehicles" element={<VehicleListPage />} />
                <Route path="/vehicles/add" element={<AddVehiclePage />} />
                <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route element={<RequireAdmin />}>
                  <Route path="/users" element={<UsersPage />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
