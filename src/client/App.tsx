import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { VehicleListPage } from "./pages/VehicleListPage.tsx";
import { VehicleDetailPage } from "./pages/VehicleDetailPage.tsx";
import { AddVehiclePage } from "./pages/AddVehiclePage.tsx";
import { SettingsPage } from "./pages/SettingsPage.tsx";
import { Layout } from "./components/Layout.tsx";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Navigate to="/vehicles" replace />} />
            <Route path="/vehicles" element={<VehicleListPage />} />
            <Route path="/vehicles/add" element={<AddVehiclePage />} />
            <Route path="/vehicles/:id" element={<VehicleDetailPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
