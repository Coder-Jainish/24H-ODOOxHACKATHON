import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

const DEMO_ACCOUNTS = [
  { email: "employee@pp360.com", role: "Employee" },
  { email: "hrm@pp360.com", role: "HR Manager" },
  { email: "hpu@pp360.com", role: "Payroll User" },
  { email: "hpm@pp360.com", role: "Payroll Manager" },
  { email: "admin@pp360.com", role: "Admin" },
];

export default function Login() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/", { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <h1>PeoplePay360</h1>
        <p className="login-sub">HR & Payroll Operations</p>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="error">{error}</div>}
        <button type="submit" disabled={busy}>
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <div className="demo-sec">
          <div className="demo-label">Demo accounts (password: password123)</div>
          <div className="demo-list">
            {DEMO_ACCOUNTS.map((a) => (
              <button
                type="button"
                key={a.email}
                className="demo-btn"
                onClick={() => {
                  setEmail(a.email);
                  setPassword("password123");
                }}
              >
                {a.role}
              </button>
            ))}
          </div>
        </div>
      </form>
    </div>
  );
}
