import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth.js";
import { describeError } from "../components/QueryState.jsx";

export default function Register() {
  const { register, login } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await register(email, password, fullName);
      await login(email, password);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.status === 409 ? "An account with this email already exists." : describeError(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-56px)] flex items-center justify-center px-4">
      <div className="atlas-card w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold mb-6">Create your Atlas account</h1>

        {error && (
          <div className="mb-4 text-sm text-atlas-critical bg-red-950/30 border border-red-900 rounded p-2">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Full name</label>
            <input className="atlas-input w-full" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
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
              minLength={8}
              className="atlas-input w-full"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">At least 8 characters.</p>
          </div>
          <button type="submit" disabled={submitting} className="atlas-btn-primary w-full">
            {submitting ? "Creating account..." : "Sign up"}
          </button>
        </form>

        <p className="mt-6 text-sm text-gray-500 text-center">
          Already have an account?{" "}
          <Link to="/login" className="text-atlas-accent hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
