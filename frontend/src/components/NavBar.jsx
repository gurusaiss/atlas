import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import Logo from "./Logo.jsx";
import ThemeToggle from "./ThemeToggle.jsx";

export default function NavBar() {
  const { user, isAuthenticated, initializing, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => setMenuOpen(false), [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  const links = [
    { to: "/demo", label: "Demo" },
    ...(isAuthenticated
      ? [
          { to: "/dashboard", label: "Projects" },
          { to: "/analytics", label: "Analytics" },
        ]
      : []),
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-rule bg-paper/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-6 px-4 sm:px-6" aria-label="Main">
        <Link to="/" className="shrink-0 text-ink transition-opacity hover:opacity-80" aria-label="Atlas home">
          <Logo />
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} className="navlink">
              {l.label}
            </NavLink>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <ThemeToggle />
          <span className="h-5 w-px bg-rule" aria-hidden="true" />
          {initializing ? (
            <span className="skeleton h-4 w-24" aria-hidden="true" />
          ) : isAuthenticated ? (
            <>
              <span className="max-w-[13rem] truncate font-mono text-xs text-ink-3" title={user?.email}>
                {user?.email}
              </span>
              <button onClick={logout} className="btn btn-quiet btn-sm">
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="navlink">
                Sign in
              </Link>
              <Link to="/register" className="btn btn-primary btn-sm">
                Get started
              </Link>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="icon-btn"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div id="mobile-menu" className="fixed inset-x-0 bottom-0 top-16 z-30 animate-fade overflow-y-auto bg-paper md:hidden">
          <div className="flex flex-col px-6 pb-10 pt-8">
            {links.map((l, i) => (
              <NavLink
                key={l.to}
                to={l.to}
                style={{ "--i": i }}
                className="rise border-b border-rule py-4 font-display text-3xl text-ink aria-[current=page]:text-accent-ink"
              >
                {l.label}
              </NavLink>
            ))}
            <div className="rise mt-8 flex flex-col gap-3" style={{ "--i": links.length }}>
              {isAuthenticated ? (
                <>
                  <p className="truncate font-mono text-xs text-ink-3">{user?.email}</p>
                  <button onClick={logout} className="btn btn-outline w-full">
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <Link to="/register" className="btn btn-primary w-full">
                    Get started
                  </Link>
                  <Link to="/login" className="btn btn-outline w-full">
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
