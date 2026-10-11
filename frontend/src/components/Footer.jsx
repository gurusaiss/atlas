import { Link } from "react-router-dom";
import Logo from "./Logo.jsx";

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-rule">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-xs text-sm leading-6 text-ink-2">
            Reads a legacy repository end to end, so the rewrite starts from a map instead of a guess.
          </p>
        </div>
        <div>
          <p className="eyebrow mb-3">Explore</p>
          <ul className="space-y-2 text-sm">
            <li>
              <Link to="/demo" className="navlink">
                Live demo
              </Link>
            </li>
            <li>
              <Link to="/register" className="navlink">
                Create an account
              </Link>
            </li>
            <li>
              <Link to="/login" className="navlink">
                Sign in
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="eyebrow mb-3">Colophon</p>
          <p className="font-mono text-xs leading-6 text-ink-3">
            LangGraph · FastAPI · React
            <br />
            PostgreSQL · ChromaDB
            <br />
            tree-sitter · Semgrep · Bandit
          </p>
        </div>
      </div>
      <div className="border-t border-rule">
        <p className="mx-auto max-w-7xl px-4 py-5 font-mono text-[0.6875rem] uppercase tracking-wider text-ink-3 sm:px-6">
          Atlas · Static analysis first, language models second
        </p>
      </div>
    </footer>
  );
}
