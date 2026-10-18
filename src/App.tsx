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
import Credits from "./pages/Credits";
import Goals from "./pages/Goals";
import Discipline from "./pages/Discipline";
import Sport from "./pages/Sport";
import Cabinet from "./pages/Cabinet";
import MoiMeme from "./pages/MoiMeme";
import Apprentissage from "./pages/Apprentissage";
import SportPerf from "./pages/SportPerf";
import History from "./pages/History";
import Responsibilities from "./pages/Responsibilities";
import Timer from "./pages/Timer";

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
            <Route path="/habitudes" element={<Navigate to="/discipline" replace />} />
            <Route path="/credits" element={<ProtectedRoute><Credits /></ProtectedRoute>} />
            <Route path="/engagements" element={<Navigate to="/objectifs" replace />} />
            <Route path="/objectifs" element={<ProtectedRoute><Goals /></ProtectedRoute>} />
            <Route path="/discipline" element={<ProtectedRoute><Discipline /></ProtectedRoute>} />
            <Route path="/sport" element={<ProtectedRoute><Sport /></ProtectedRoute>} />
            <Route path="/cabinet" element={<ProtectedRoute><Cabinet /></ProtectedRoute>} />
            <Route path="/moi-meme" element={<ProtectedRoute><MoiMeme /></ProtectedRoute>} />
            <Route path="/apprentissage" element={<ProtectedRoute><Apprentissage /></ProtectedRoute>} />
            <Route path="/performances-sport" element={<ProtectedRoute><SportPerf /></ProtectedRoute>} />
            <Route path="/historique" element={<ProtectedRoute><History /></ProtectedRoute>} />
            <Route path="/responsabilites" element={<ProtectedRoute><Responsibilities /></ProtectedRoute>} />
            <Route path="/calories" element={<Navigate to="/sport" replace />} />
            <Route path="/routines" element={<Navigate to="/responsabilites" replace />} />
            <Route path="/timer" element={<ProtectedRoute><Timer /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
