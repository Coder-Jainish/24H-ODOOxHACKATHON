import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth-context";
import AppShell from "./components/AppShell";
import RequireAuth from "./components/RequireAuth";
import Login from "./pages/Login";
import Home from "./pages/Home";
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
import Payruns from "./pages/Payruns";
import PayrunDetail from "./pages/PayrunDetail";
import Payslips from "./pages/Payslips";
import PayslipDetail from "./pages/PayslipDetail";
import Attendance from "./pages/Attendance";
import Dashboard from "./pages/Dashboard";
import "./styles.css";

// HR-management sections (Employees, Contracts, Schedules, Attendance, Time Off)
// belong to the HR Manager (and Admin). Payroll roles have no HR sections (PRD §3).
const HR_ROLES = ["HR_MANAGER", "ADMIN"];
const PAYROLL_ROLES = ["HR_PAYROLL_USER", "HR_PAYROLL_MANAGER", "ADMIN"];
// Attendance: every staff role logs their own check-in/out ("My Attendance"); the
// Employee page shows the self-service view, HR Manager/Admin additionally review all.
const ATTENDANCE_ROLES = ["EMPLOYEE", "HR_MANAGER", "HR_PAYROLL_USER", "HR_PAYROLL_MANAGER", "ADMIN"];
// Time Off Requests: employees manage their own; HR Manager reviews/approves.
const TIME_OFF_REQ_ROLES = ["EMPLOYEE", "HR_MANAGER", "ADMIN"];
// Payroll Dashboard: analytics view for payroll roles + Admin only (HR Manager has
// no Payroll access per PRD §3).
const DASHBOARD_ROLES = ["HR_PAYROLL_USER", "HR_PAYROLL_MANAGER", "ADMIN"];

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
          <Route path="/" element={<Shell><Home /></Shell>} />
          <Route path="/dashboard" element={<Shell roles={DASHBOARD_ROLES}><Dashboard /></Shell>} />
          <Route path="/employees" element={<Shell roles={HR_ROLES}><Employees /></Shell>} />
          <Route path="/employees/:id" element={<Shell roles={HR_ROLES}><EmployeeDetail /></Shell>} />
          <Route path="/employees/:id/contracts" element={<Shell roles={HR_ROLES}><Contracts /></Shell>} />
          <Route path="/contracts" element={<Shell roles={HR_ROLES}><Contracts /></Shell>} />
          <Route path="/schedules" element={<Shell roles={HR_ROLES}><Schedules /></Shell>} />
          <Route path="/attendance" element={<Shell roles={ATTENDANCE_ROLES}><Attendance /></Shell>} />
          <Route path="/employees/:id/attendance" element={<Shell roles={HR_ROLES}><Attendance /></Shell>} />
          <Route path="/employees/:id/time-off" element={<Shell roles={HR_ROLES}><EmployeeTimeOff /></Shell>} />
          <Route path="/time-off/requests" element={<Shell roles={TIME_OFF_REQ_ROLES}><TimeOffRequests /></Shell>} />
          <Route path="/time-off/allocations" element={<Shell roles={HR_ROLES}><Allocations /></Shell>} />
          <Route path="/time-off/types" element={<Shell roles={HR_ROLES}><TimeOffTypes /></Shell>} />
          <Route path="/payruns" element={<Shell roles={PAYROLL_ROLES}><Payruns /></Shell>} />
          <Route path="/payruns/:id" element={<Shell roles={PAYROLL_ROLES}><PayrunDetail /></Shell>} />
          <Route path="/payslips" element={<Shell roles={PAYROLL_ROLES}><Payslips /></Shell>} />
          <Route path="/payslips/:id" element={<Shell roles={PAYROLL_ROLES}><PayslipDetail /></Shell>} />
          <Route path="/salary-structures" element={<Shell roles={PAYROLL_ROLES}><SalaryStructures /></Shell>} />
          <Route path="/salary-rules" element={<Shell roles={PAYROLL_ROLES}><SalaryRules /></Shell>} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
