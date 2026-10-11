import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import { describeError } from "../components/QueryState.jsx";
import AuthShell, { Field, FormError, PasswordInput } from "../components/AuthShell.jsx";
import { usePageTitle } from "../hooks/usePageTitle.js";

export default function Register() {
  usePageTitle("Create account");
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
    <AuthShell
      eyebrow="Get started"
      title="Create your account"
      subtitle="Free to try. Upload a repository and get your first report in minutes."
      footer={
        <p>
          Already registered?{" "}
          <Link to="/login" className="link">
            Sign in
          </Link>
        </p>
      }
    >
      <FormError>{error}</FormError>
      <form onSubmit={handleSubmit} className="space-y-6">
        <Field label="Full name">
          <input autoComplete="name" autoFocus className="field" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </Field>
        <Field label="Email">
          <input type="email" required autoComplete="email" className="field" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} />
        </Field>
        <button type="submit" disabled={submitting} className="btn btn-primary w-full !py-3">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}
