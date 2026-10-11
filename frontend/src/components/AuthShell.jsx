import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import Contour from "./Contour.jsx";

export default function AuthShell({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-ink text-paper lg:block">
        <Contour seed="atlas-auth" cols={60} rows={70} levels={18} className="absolute inset-0 h-full w-full drift text-paper/[0.16]" />
        <div className="relative flex h-full flex-col justify-end p-12">
          <p className="font-display text-4xl leading-tight" style={{ fontVariationSettings: '"SOFT" 60, "opsz" 96' }}>
            Every codebase has a shape.
            <br />
            <span className="italic text-accent">Atlas</span> draws it.
          </p>
          <p className="mt-6 font-mono text-xs uppercase tracking-widest text-paper/50">Architecture · tests · security</p>
        </div>
      </aside>

      <section className="flex items-center justify-center px-5 py-14 sm:px-10">
        <div className="rise w-full max-w-sm">
          <p className="eyebrow mb-3">{eyebrow}</p>
          <h1 className="display text-4xl">{title}</h1>
          {subtitle && <p className="mt-3 text-sm leading-6 text-ink-2">{subtitle}</p>}
          <div className="mt-9">{children}</div>
          {footer && <div className="mt-8 text-sm text-ink-2">{footer}</div>}
        </div>
      </section>
    </div>
  );
}

export function FormError({ children }) {
  if (!children) return null;
  return (
    <div role="alert" className="mb-6 animate-pop border-l-2 border-crit bg-crit/10 px-3 py-2.5 text-sm text-ink">
      {children}
    </div>
  );
}

export function Field({ label, hint, children }) {
  return (
    <label className="block">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-ink-3">{hint}</span>}
    </label>
  );
}

export function PasswordInput({ value, onChange, autoComplete, minLength }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative">
      <input
        type={shown ? "text" : "password"}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        className="field pr-9"
        value={value}
        onChange={onChange}
      />
      <button
        type="button"
        onClick={() => setShown((s) => !s)}
        className="absolute right-0 top-1/2 -translate-y-1/2 p-1.5 text-ink-3 transition-colors hover:text-ink"
        aria-label={shown ? "Hide password" : "Show password"}
      >
        {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}
