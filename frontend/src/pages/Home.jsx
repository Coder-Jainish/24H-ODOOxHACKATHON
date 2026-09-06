import Profile from "./Profile";

// Role-aware default landing page ("/"): every role sees their own profile
// (name, department, working schedule, leave balances). HR/payroll sections are
// reached from the topbar menu.
export default function Home() {
  return <Profile />;
}