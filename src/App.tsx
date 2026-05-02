import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Expenses from "./pages/Expenses";
import Payments from "./pages/Payments";
import Habits from "./pages/Habits";
import Credits from "./pages/Credits";
import Engagements from "./pages/Engagements";
import Goals from "./pages/Goals";
import HighPerformance from "./pages/HighPerformance";
import Discipline from "./pages/Discipline";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <Auth />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/depenses" element={<ProtectedRoute><Expenses /></ProtectedRoute>} />
            <Route path="/paiements" element={<ProtectedRoute><Payments /></ProtectedRoute>} />
            <Route path="/habitudes" element={<ProtectedRoute><Habits /></ProtectedRoute>} />
            <Route path="/credits" element={<ProtectedRoute><Credits /></ProtectedRoute>} />
            <Route path="/engagements" element={<ProtectedRoute><Engagements /></ProtectedRoute>} />
            <Route path="/objectifs" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
            <Route path="/performance" element={<ProtectedRoute><HighPerformance /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
