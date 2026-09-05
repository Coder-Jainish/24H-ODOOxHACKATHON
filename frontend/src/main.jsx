import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth-context";
import AppShell from "./components/AppShell";
import RequireAuth from "./components/RequireAuth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Placeholder from "./pages/Placeholder";
import Employees from "./pages/Employees";
import EmployeeDetail from "./pages/EmployeeDetail";
import "./styles.css";

const HR_ROLES = ["HR_MANAGER", "HR_PAYROLL_USER", "HR_PAYROLL_MANAGER", "ADMIN"];
const PAYROLL_ROLES = ["HR_PAYROLL_USER", "HR_PAYROLL_MANAGER", "ADMIN"];
const CONFIG_ROLES = ["HR_PAYROLL_MANAGER", "ADMIN"];

// Shell wraps children with AppShell + RequireAuth (no roles — just auth).
function Shell({ children, roles }) {
  return (
    <RequireAuth roles={roles}>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Shell><Dashboard /></Shell>} />
          <Route path="/employees" element={<Shell roles={HR_ROLES}><Employees /></Shell>} />
          <Route path="/employees/:id" element={<Shell roles={HR_ROLES}><EmployeeDetail /></Shell>} />
          <Route path="/contracts" element={<Shell roles={HR_ROLES}><Placeholder title="Contracts" desc="Contracts feature lands in Phase 3." /></Shell>} />
          <Route path="/attendance" element={<Shell roles={HR_ROLES}><Placeholder title="Attendance" desc="Attendance feature lands in a later phase." /></Shell>} />
          <Route path="/time-off/requests" element={<Shell roles={HR_ROLES}><Placeholder title="Time Off Requests" desc="Time Off Requests lands in a later phase." /></Shell>} />
          <Route path="/time-off/allocations" element={<Shell roles={HR_ROLES}><Placeholder title="Allocations" desc="Allocations feature lands in a later phase." /></Shell>} />
          <Route path="/time-off/types" element={<Shell roles={HR_ROLES}><Placeholder title="Time Off Types" desc="Time Off Types feature lands in a later phase." /></Shell>} />
          <Route path="/payruns" element={<Shell roles={PAYROLL_ROLES}><Placeholder title="Payruns" desc="Payruns feature lands in a later phase." /></Shell>} />
          <Route path="/payslips" element={<Shell roles={PAYROLL_ROLES}><Placeholder title="Payslips" desc="Payslips feature lands in a later phase." /></Shell>} />
          <Route path="/salary-structures" element={<Shell roles={CONFIG_ROLES}><Placeholder title="Salary Structures" desc="Salary Structures feature lands in a later phase." /></Shell>} />
          <Route path="/salary-rules" element={<Shell roles={CONFIG_ROLES}><Placeholder title="Salary Rules" desc="Salary Rules feature lands in a later phase." /></Shell>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
