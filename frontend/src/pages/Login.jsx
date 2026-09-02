import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { describeError } from "../components/QueryState.jsx";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || "/dashboard";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoLogin() {
    setError("");
    setSubmitting(true);
    try {
      await login("demo@atlas.ai", "DemoAtlas2024!");
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err.response?.status === 401) {
        setError("Demo login failed — has seed_demo_data.py been run against this database?");
      } else {
        setError(describeError(err));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
      <div className="atlas-card w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold mb-6">Log in to Atlas</h1>

        {error && (
          <div className="mb-4 text-sm text-atlas-critical bg-red-950/30 border border-red-900 rounded p-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input
              type="email"
              required
              className="atlas-input w-full"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input
              type="password"
              required
              className="atlas-input w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button type="submit" disabled={submitting} className="atlas-btn-primary w-full">
            {submitting ? "Logging in..." : "Log in"}
          </button>
        </form>

        <div className="my-4 flex items-center gap-2 text-xs text-gray-500">
          <div className="flex-1 h-px bg-atlas-border" />
          or
          <div className="flex-1 h-px bg-atlas-border" />
        </div>

        <button onClick={handleDemoLogin} disabled={submitting} className="atlas-btn-secondary w-full">
          Log in as demo user
        </button>

        <p className="mt-6 text-sm text-gray-500 text-center">
          No account?{" "}
          <Link to="/register" className="text-atlas-accent hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
