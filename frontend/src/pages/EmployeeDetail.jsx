import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import EmployeeForm from "../components/EmployeeForm";
import AllocationForm from "../components/AllocationForm";
import { fmtDate } from "../components/AllocationTable";

function initials(name = "") {
  return name.split(" ").map((w) => (w[0] || "").toUpperCase()).slice(0, 2).join("");
}

export default function EmployeeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [emp, setEmp] = useState(null);
  const [timeOff, setTimeOff] = useState({ allocations: [] });
  const [loading, setLoading] = useState(true);
  const [showEdit, setShowEdit] = useState(false);
  const [showAllocate, setShowAllocate] = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      api(`/employees/${id}`),
      api(`/employees/${id}/time-off`).catch(() => ({ allocations: [] })),
    ])
      .then(([e, t]) => {
        setEmp(e);
        setTimeOff(t);
      })
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  if (loading) return <p className="muted">Loading…</p>;
  if (!emp) return <p className="muted">Employee not found.</p>;

  const counts = emp._count || { contracts: 0, attendances: 0, requests: 0, allocations: 0 };

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-secondary" onClick={() => navigate("/employees")}>
          ← Back
        </button>
        <div className="smart-buttons">
          <button className="smart-btn" onClick={() => navigate(`/employees/${id}/contracts`)}>
            Contracts <span className="smart-count">{counts.contracts}</span>
          </button>
          <button className="smart-btn" onClick={() => navigate(`/employees/${id}/attendance`)}>
            Attendance <span className="smart-count">{counts.attendances}</span>
          </button>
          <button className="smart-btn" onClick={() => navigate(`/employees/${id}/time-off`)}>
            Time Off <span className="smart-count">{counts.requests + counts.allocations}</span>
          </button>
          <button className="smart-btn" onClick={() => setShowEdit(true)}>
            EDIT
          </button>
        </div>
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
          <Field label="Department" value={emp.department} />
          <Field label="Job Position" value={emp.jobPosition} />
          <Field label="Manager" value={emp.manager?.name || "—"} />
          <Field label="Working Schedule" value={emp.workingSchedule ? `${emp.workingSchedule.name} (${emp.workingSchedule.totalWeeklyHours} hrs/wk)` : "—"} />
          <Field label="Work Email" value={emp.email} />
          <Field label="Status" value={<span className={"badge " + (emp.isActive ? "badge-active" : "badge-inactive")}>{emp.isActive ? "Active" : "Inactive"}</span>} />
        </div>
        <div className="card detail-card">
          <h3>Time Off Balances</h3>
          {timeOff.allocations.length === 0 ? (
            <p className="muted">No allocations yet.</p>
          ) : (
            timeOff.allocations.map((a) => (
              <div className="field" key={a.id}>
                <span className="field-label">
                  {a.timeOffType?.name}
                  {!a.approvedByHR && <span className="status-pill amber">Pending</span>}
                </span>
                <span className="field-value">
                  <strong>{Number(a.remaining)}</strong> / {Number(a.quota)} {a.timeOffType?.unit === "HOURS" ? "hrs" : "days"}
                  <span className="muted small"> · {fmtDate(a.validFrom)} → {fmtDate(a.validTo)}</span>
                </span>
              </div>
            ))
          )}
          <div className="modal-actions" style={{ marginTop: "0.75rem" }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setShowAllocate(true)}>
              Allocate Leave
            </button>
          </div>
        </div>
      </div>

      {showEdit && (
        <EmployeeForm employee={emp} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load(); }} />
      )}

      {showAllocate && (
        <AllocationForm
          employee={emp}
          onClose={() => setShowAllocate(false)}
          onSaved={() => {
            setShowAllocate(false);
            load();
          }}
        />
      )}
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