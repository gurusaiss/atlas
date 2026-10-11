import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import Contour from "./Contour.jsx";

export function PageLoader({ label = "Loading" }) {
  return (
    <div className="relative flex min-h-[60vh] items-center justify-center overflow-hidden" role="status">
      <Contour seed="loader" cols={50} rows={30} levels={10} className="absolute inset-0 h-full w-full drift text-ink/[0.1]" />
      <p className="relative flex items-center gap-3 font-mono text-xs uppercase tracking-widest text-ink-3">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
        {label}
      </p>
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, initializing } = useAuth();
  const location = useLocation();

  if (initializing) return <PageLoader label="Restoring your session" />;

  if (!isAuthenticated) {
    // Remember where the visitor was headed so sign-in can send them back.
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  return children;
}
