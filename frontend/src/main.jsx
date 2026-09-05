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
import Contracts from "./pages/Contracts";
import Schedules from "./pages/Schedules";
import TimeOffTypes from "./pages/TimeOffTypes";
import Allocations from "./pages/Allocations";
import EmployeeTimeOff from "./pages/EmployeeTimeOff";
import TimeOffRequests from "./pages/TimeOffRequests";
import SalaryStructures from "./pages/SalaryStructures";
import SalaryRules from "./pages/SalaryRules";
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
          <Route path="/employees/:id/contracts" element={<Shell roles={HR_ROLES}><Contracts /></Shell>} />
          <Route path="/contracts" element={<Shell roles={HR_ROLES}><Contracts /></Shell>} />
          <Route path="/schedules" element={<Shell roles={HR_ROLES}><Schedules /></Shell>} />
          <Route path="/attendance" element={<Shell roles={HR_ROLES}><Placeholder title="Attendance" desc="Attendance feature lands in a later phase." /></Shell>} />
          <Route path="/employees/:id/time-off" element={<Shell roles={HR_ROLES}><EmployeeTimeOff /></Shell>} />
          <Route path="/time-off/requests" element={<Shell><TimeOffRequests /></Shell>} />
          <Route path="/time-off/allocations" element={<Shell roles={HR_ROLES}><Allocations /></Shell>} />
          <Route path="/time-off/types" element={<Shell roles={HR_ROLES}><TimeOffTypes /></Shell>} />
          <Route path="/payruns" element={<Shell roles={PAYROLL_ROLES}><Placeholder title="Payruns" desc="Payruns feature lands in a later phase." /></Shell>} />
          <Route path="/payslips" element={<Shell roles={PAYROLL_ROLES}><Placeholder title="Payslips" desc="Payslips feature lands in a later phase." /></Shell>} />
          <Route path="/salary-structures" element={<Shell roles={CONFIG_ROLES}><SalaryStructures /></Shell>} />
          <Route path="/salary-rules" element={<Shell roles={CONFIG_ROLES}><SalaryRules /></Shell>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
