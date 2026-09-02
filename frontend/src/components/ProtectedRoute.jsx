import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();

  if (initializing) {
    return (
      <div className="min-h-[calc(100vh-56px)] flex items-center justify-center text-gray-500 gap-2">
        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        Loading…
      </div>
    );
  }

  if (!isAuthenticated) {
    // Preserve where the user was headed so Login can send them back after
    // signing in, instead of always dropping them on /dashboard.
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  return children;
}
