import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BarChart2, LayoutDashboard, LogOut, Menu, Sparkles, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";

export default function NavBar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  function closeMenu() {
    setMenuOpen(false);
  }

  const authedLinks = (
    <>
      <button
        onClick={() => {
          closeMenu();
          navigate("/dashboard");
        }}
        className="flex items-center gap-1 text-gray-400 hover:text-gray-100"
      >
        <LayoutDashboard className="w-4 h-4" aria-hidden="true" />
        Dashboard
      </button>
      <button
        onClick={() => {
          closeMenu();
          navigate("/analytics");
        }}
        className="flex items-center gap-1 text-gray-400 hover:text-gray-100"
      >
        <BarChart2 className="w-4 h-4" aria-hidden="true" />
        Analytics
      </button>
      {/* Email is the least important item, so it's the first thing dropped on narrow screens. */}
      <span className="text-gray-500 truncate max-w-[12rem] hidden lg:inline">{user?.email}</span>
      <button
        onClick={() => {
          closeMenu();
          logout();
        }}
        className="flex items-center gap-1 text-gray-400 hover:text-atlas-critical"
      >
        <LogOut className="w-4 h-4" aria-hidden="true" />
        Logout
      </button>
    </>
  );

  const guestLinks = (
    <>
      <Link to="/login" onClick={closeMenu} className="text-gray-400 hover:text-gray-100">
        Login
      </Link>
      <Link to="/register" onClick={closeMenu} className="atlas-btn-primary text-sm py-1.5">
        Sign up
      </Link>
    </>
  );

  return (
    <nav className="border-b border-atlas-border bg-atlas-panel">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link to="/" onClick={closeMenu} className="flex items-center gap-2 font-semibold text-lg shrink-0">
          <Sparkles className="w-5 h-5 text-atlas-accent" aria-hidden="true" />
          Atlas
        </Link>

        <div className="hidden md:flex items-center gap-4 text-sm">
          <Link to="/demo" className="text-gray-400 hover:text-gray-100">
            Demo
          </Link>
          {isAuthenticated ? authedLinks : guestLinks}
        </div>

        <button
          onClick={() => setMenuOpen((open) => !open)}
          className="md:hidden text-gray-400 hover:text-gray-100 p-1"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden border-t border-atlas-border px-4 py-4 flex flex-col gap-4 text-sm">
          <Link to="/demo" onClick={closeMenu} className="text-gray-400 hover:text-gray-100">
            Demo
          </Link>
          {isAuthenticated ? authedLinks : guestLinks}
        </div>
      )}
    </nav>
  );
}
