import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import { describeError } from "../components/QueryState.jsx";
import AuthShell, { Field, FormError, PasswordInput } from "../components/AuthShell.jsx";
import { usePageTitle } from "../hooks/usePageTitle.js";

export default function Login() {
  usePageTitle("Sign in");
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function attempt(creds, onAuthFail) {
    setError("");
    setSubmitting(true);
    try {
      await login(creds.email, creds.password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.status === 401 ? onAuthFail : describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    attempt({ email, password }, "That email and password don't match an account.");
  }

  function handleDemoLogin() {
    attempt({ email: "demo@atlas.ai", password: "DemoAtlas2024!" }, "The demo account isn't available right now.");
  }

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to Atlas"
      footer={
        <p>
          New here?{" "}
          <Link to="/register" className="link">
            Create an account
          </Link>
        </p>
      }
    >
      <FormError>{error}</FormError>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Field label="Email">
          <input type="email" required autoComplete="email" autoFocus className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password">
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        <button type="submit" disabled={submitting} className="btn btn-primary w-full !py-3">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="my-7 flex items-center gap-3 font-mono text-[0.6875rem] uppercase tracking-widest text-ink-3">
        <span className="h-px flex-1 bg-rule" />
        or
        <span className="h-px flex-1 bg-rule" />
      </div>

      <button onClick={handleDemoLogin} disabled={submitting} className="btn btn-outline w-full">
        Explore with the demo account
      </button>
    </AuthShell>
  );
}
