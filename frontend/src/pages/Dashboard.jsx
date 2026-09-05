import { useAuth } from "../lib/auth-context";

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <div>
      <h1>Welcome, {user?.role}</h1>
      <p>
        This is the role-correct shell for <strong>{user?.role}</strong>. Feature modules
        will appear here as you build them out.
      </p>
      <p className="muted">
        Currently signed in as <strong>{user?.email}</strong>.
      </p>
    </div>
  );
}
