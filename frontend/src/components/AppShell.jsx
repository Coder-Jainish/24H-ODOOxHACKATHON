import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

// Odoo-style top navbar with dropdown menus (matches Design/#screenflow).
// RBAC-aware: items shown/hidden per role (API.md §12).
function Dropdown({ label, items, onNavigate, active }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function onClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="nav-item" ref={ref}>
      <button
        className={"nav-toggle" + (open ? " open" : "") + (active ? " active-nav" : "")}
        onClick={() => setOpen(!open)}
      >
        {label} <span className="caret">▾</span>
      </button>
      {open && (
        <div className="nav-menu">
          {items.map((it) => (
            <button
              key={it.to}
              className="nav-menu-item"
              onClick={() => {
                setOpen(false);
                onNavigate(it.to);
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const role = user?.role;

  // HR-management sections belong to the HR Manager and Admin only. Payroll roles
  // (Payroll User / Payroll Manager) and Admin get the Payroll menu (PRD §3).
  // HR Manager is NOT given Payroll access.
  const isHR = ["HR_MANAGER", "ADMIN"].includes(role);
  const isPayroll = ["HR_PAYROLL_USER", "HR_PAYROLL_MANAGER", "ADMIN"].includes(role);

  const go = (to) => navigate(to);
  const isActive = (path) => pathname === path || pathname.startsWith(path + "/");

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand" onClick={() => go("/")}>
            <span className="brand-tile">P</span>PeoplePay360
          </span>
          <span className={"nav-link-plain" + (isActive("/") ? " active-nav" : "")} onClick={() => go("/")}>
            My Profile
          </span>
          {isHR && (
            <Dropdown
              label="Employees"
              active={isActive("/employees") || isActive("/schedules")}
              items={[{ to: "/employees", label: "Employees" }, { to: "/schedules", label: "Working Schedules" }]}
              onNavigate={go}
            />
          )}
          {isHR && (
            <Dropdown label="Contracts" active={isActive("/contracts")} items={[{ to: "/contracts", label: "Contracts" }]} onNavigate={go} />
          )}
          {isHR && (
            <span className={"nav-link-plain" + (isActive("/attendance") ? " active-nav" : "")} onClick={() => go("/attendance")}>
              Attendance
            </span>
          )}
          {isHR && (
            <Dropdown
              label="Time Off"
              active={isActive("/time-off")}
              items={[
                { to: "/time-off/requests", label: "Time Off Requests" },
                { to: "/time-off/allocations", label: "Grant Allocations" },
                { to: "/time-off/types", label: "Time Off Types" },
              ]}
              onNavigate={go}
            />
          )}
          {(role === "EMPLOYEE" || role === "HR_PAYROLL_USER" || role === "HR_PAYROLL_MANAGER") && (
            <span className={"nav-link-plain" + (isActive("/attendance") ? " active-nav" : "")} onClick={() => go("/attendance")}>
              My Attendance
            </span>
          )}
          {role === "EMPLOYEE" && (
            <span className={"nav-link-plain" + (isActive("/time-off/requests") ? " active-nav" : "")} onClick={() => go("/time-off/requests")}>
              My Time Off
            </span>
          )}
          {isPayroll && (
            <Dropdown
              label="Payroll"
              active={isActive("/dashboard") || isActive("/payruns") || isActive("/payslips") || isActive("/salary-structures") || isActive("/salary-rules")}
              items={[
                { to: "/dashboard", label: "Payroll Dashboard" },
                { to: "/payruns", label: "Payruns" },
                { to: "/payslips", label: "Payslips" },
                { to: "/salary-structures", label: "Salary Structures" },
                { to: "/salary-rules", label: "Salary Rules" },
              ]}
              onNavigate={go}
            />
          )}
        </div>
        <div className="topbar-right">
          <span className="user-chip">{emailInitials(user?.email)}</span>
          <div className="user-wrap">
            <div className="user-email">{user?.email}</div>
            <div className="user-role">{role}</div>
          </div>
          <button className="logout-btn" onClick={() => logout()}>
            Logout
          </button>
        </div>
      </header>
      <main className="app-main">{children}</main>
    </div>
  );
}

function emailInitials(email = "") {
  const w = email.split("@")[0];
  return (w[0] || "?").toUpperCase() + (w[w.length - 1] || "").toUpperCase();
}
