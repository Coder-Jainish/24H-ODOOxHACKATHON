import Dashboard from "./Dashboard";
import Employees from "./Employees";
import EmployeeHome from "./EmployeeHome";
import { useAuth } from "../lib/auth-context";

// Role-aware default landing page ("/"):
//  - EMPLOYEE        → their own profile + assigned working schedule
//  - HR_MANAGER      → the Employees master (their main operational screen)
//  - Payroll / Admin → the live payroll Dashboard
export default function Home() {
  const { user } = useAuth();
  const role = user?.role;

  if (role === "EMPLOYEE") return <EmployeeHome />;
  if (role === "HR_MANAGER") return <Employees />;
  return <Dashboard />;
}