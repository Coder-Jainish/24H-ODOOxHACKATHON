import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { DAYS } from "./Schedules";

// Self-service landing page for the EMPLOYEE role (API.md §1 "/employees/me").
// Shows the signed-in employee's own profile details, their assigned working
// schedule (only the schedule they were provided) and their time-off balances.
function initials(name = "") {
  return name.split(" ").map((w) => (w[0] || "").toUpperCase()).slice(0, 2).join("");
}

export default function EmployeeHome() {
  const { user } = useAuth();
  const [emp, setEmp] = useState(null);
  const [timeOff, setTimeOff] = useState({ allocations: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api("/employees/me"),
      api(`/employees/${user?.employeeId}/time-off`).catch(() => ({ allocations: [] })),
    ])
      .then(([e, t]) => {
        if (cancelled) return;
        setEmp(e);
        setTimeOff(t);
      })
      .catch((err) => alert(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user?.employeeId]);

  if (loading) return <p className="muted">Loading…</p>;
  if (!emp) return <p className="muted">Employee profile not found.</p>;

  const schedule = emp.workingSchedule;
  const shifts = (schedule?.shifts || []).slice().sort((a, b) => a.dayOfWeek - b.dayOfWeek);

  return (
    <div>
      <div className="page-header">
        <h1>My Profile</h1>
        <span className="muted small">Your employee details, working schedule and leave balances</span>
      </div>

      <div className="employee-header">
        <div className="avatar large">{initials(emp.name)}</div>
        <div>
          <h1>{emp.name}</h1>
          <div className="emp-sub">
            {emp.jobPosition} • {emp.department}
          </div>
          <div className="emp-contact">{emp.email}</div>
        </div>
      </div>

      <div className="detail-grid">
        <div className="card detail-card">
          <h3>Work Information</h3>
          <Field label="Employee ID" value={String(emp.id).slice(0, 8).toUpperCase()} />
          <Field label="Department" value={emp.department} />
          <Field label="Job Position" value={emp.jobPosition} />
          <Field label="Manager" value={emp.manager?.name || "—"} />
          <Field label="Working Schedule" value={schedule ? `${schedule.name} · ${Number(schedule.totalWeeklyHours)} hrs/wk` : "—"} />
          <Field label="Work Email" value={emp.email} />
          <Field label="Status" value={<span className="badge badge-active">{emp.isActive ? "Active" : "Inactive"}</span>} />
        </div>

        <div className="card detail-card">
          <h3>My Working Schedule</h3>
          {!schedule ? (
            <p className="muted">No working schedule assigned yet — contact HR.</p>
          ) : (
            <>
              <p className="emp-sub">{schedule.name}</p>
              <div>
                {shifts.map((s) => (
                  <span className="day-chip" key={s.id}>
                    {DAYS[s.dayOfWeek]} {s.startTime}–{s.endTime}
                    {s.breakMinutes ? ` (${s.breakMinutes}m)` : ""}
                  </span>
                ))}
                {shifts.length === 0 && <p className="muted">No shifts defined.</p>}
              </div>
              <div className="weekly-total">
                Total: <strong>{Number(schedule.totalWeeklyHours)} hrs / week</strong>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginBottom: "0.75rem" }}>My Leave Balances</h3>
        {timeOff.allocations.length === 0 ? (
          <p className="muted">You have no leave allocations yet — ask HR to allocate some.</p>
        ) : (
          <div className="balance-strip">
            {timeOff.allocations.map((a) => (
              <div className="balance-chip" key={a.id}>
                <strong>{a.timeOffType?.name}</strong>
                <span>
                  {Number(a.remaining)} / {Number(a.quota)} {a.timeOffType?.unit === "HOURS" ? "hrs" : "days"}
                </span>
                {!a.approvedByHR && <span className="status-pill amber">Pending</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }) {
  return (
    <div className="field">
      <span className="field-label">{label}</span>
      <span className="field-value">{value}</span>
    </div>
  );
}