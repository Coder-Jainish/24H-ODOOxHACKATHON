import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

// Route guard: redirects unauthenticated users to /login.
// Role-based access: if `roles` is provided and user's role isn't allowed → redirect to dashboard.
export default function RequireAuth({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div style={{ padding: "3rem", textAlign: "center" }}>Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}
