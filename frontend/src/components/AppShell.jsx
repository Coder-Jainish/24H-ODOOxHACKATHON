import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth-context";

// Odoo-style top navbar with dropdown menus (matches Design/#screenflow).
// RBAC-aware: items shown/hidden per role (API.md §12).
function Dropdown({ label, items, onNavigate }) {
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
      <button className={"nav-toggle" + (open ? " open" : "")} onClick={() => setOpen(!open)}>
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

  const role = user?.role;

  const isHR = ["HR_MANAGER", "HR_PAYROLL_USER", "HR_PAYROLL_MANAGER", "ADMIN"].includes(role);
  const isPayroll = ["HR_PAYROLL_USER", "HR_PAYROLL_MANAGER", "ADMIN"].includes(role);
  const isConfig = ["HR_PAYROLL_MANAGER", "ADMIN"].includes(role);

  const go = (to) => navigate(to);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <span className="brand" onClick={() => go("/")}>
            OXP
          </span>
          {isHR && (
            <Dropdown label="Employees" items={[{ to: "/employees", label: "Employees" }, { to: "/schedules", label: "Working Schedules" }]} onNavigate={go} />
          )}
          {isHR && (
            <Dropdown label="Contracts" items={[{ to: "/contracts", label: "Contracts" }]} onNavigate={go} />
          )}
          {isHR && (
            <span className="nav-link-plain" onClick={() => go("/attendance")}>
              Attendance
            </span>
          )}
          {isHR && (
            <Dropdown
              label="Time Off"
              items={[
                { to: "/time-off/requests", label: "Time Off Requests" },
                { to: "/time-off/allocations", label: "Grant Allocations" },
                { to: "/time-off/types", label: "Time Off Types" },
              ]}
              onNavigate={go}
            />
          )}
          {role === "EMPLOYEE" && (
            <span className="nav-link-plain" onClick={() => go("/time-off/requests")}>
              My Time Off
            </span>
          )}
          {isPayroll && (
            <Dropdown
              label="Payroll"
              items={[
                { to: "/payruns", label: "Payruns" },
                { to: "/payslips", label: "Payslips" },
                ...(isConfig
                  ? [
                      { to: "/salary-structures", label: "Salary Structures" },
                      { to: "/salary-rules", label: "Salary Rules" },
                    ]
                  : []),
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
