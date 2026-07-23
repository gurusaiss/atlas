import { Link, useNavigate } from "react-router-dom";
import { LayoutDashboard, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";

export default function NavBar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="border-b border-atlas-border bg-atlas-panel">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-semibold text-lg">
          <Sparkles className="w-5 h-5 text-atlas-accent" />
          Atlas
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <Link to="/demo" className="text-gray-400 hover:text-gray-100">
            Demo
          </Link>
          {isAuthenticated ? (
            <>
              <button
                onClick={() => navigate("/dashboard")}
                className="flex items-center gap-1 text-gray-400 hover:text-gray-100"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </button>
              <span className="text-gray-500">{user?.email}</span>
              <button onClick={logout} className="flex items-center gap-1 text-gray-400 hover:text-atlas-critical">
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="text-gray-400 hover:text-gray-100">
                Login
              </Link>
              <Link to="/register" className="atlas-btn-primary text-sm py-1.5">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
