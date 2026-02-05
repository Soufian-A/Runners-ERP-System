import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Orders from "./pages/Orders";
import EcomOrders from "./pages/EcomOrders";
import InstantOrders from "./pages/InstantOrders";
import Drivers from "./pages/Drivers";
import CRM from "./pages/CRM";
import Cashbox from "./pages/Cashbox";
import Reports from "./pages/Reports";
import TransactionHistory from "./pages/TransactionHistory";
import ThirdPartyStatements from "./pages/ThirdPartyStatements";
import ThirdParties from "./pages/ThirdParties";
import TrackOrder from "./pages/TrackOrder";
import UserManagement from "./pages/UserManagement";
import AuditLog from "./pages/AuditLog";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public routes */}
          <Route path="/auth" element={<Auth />} />
          
          {/* Protected routes - require authentication */}
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
          <Route path="/orders/ecom" element={<ProtectedRoute><EcomOrders /></ProtectedRoute>} />
          <Route path="/orders/instant" element={<ProtectedRoute><InstantOrders /></ProtectedRoute>} />
          <Route path="/drivers" element={<ProtectedRoute><Drivers /></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute><CRM /></ProtectedRoute>} />
          <Route path="/cashbox" element={<ProtectedRoute><Cashbox /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
          <Route path="/transactions" element={<ProtectedRoute><TransactionHistory /></ProtectedRoute>} />
          <Route path="/third-party-statements" element={<ProtectedRoute><ThirdPartyStatements /></ProtectedRoute>} />
          <Route path="/third-parties" element={<ProtectedRoute><ThirdParties /></ProtectedRoute>} />
          <Route path="/track" element={<ProtectedRoute><TrackOrder /></ProtectedRoute>} />
          
          {/* Admin-only routes */}
          <Route path="/users" element={<ProtectedRoute allowedRoles={['admin']}><UserManagement /></ProtectedRoute>} />
          <Route path="/audit-log" element={<ProtectedRoute allowedRoles={['admin']}><AuditLog /></ProtectedRoute>} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
