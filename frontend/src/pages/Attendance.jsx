import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";

const STATUS_LABEL = {
  PRESENT: "Present",
  LATE: "Late",
  ABSENT: "Absent",
  OVERTIME: "Overtime",
  MISSING_CHECKOUT: "Missing checkout",
};

function formatDate(value) {
  return value ? new Date(value).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—";
}

export default function Attendance() {
  const { id } = useParams();
  const { user } = useAuth();
  const isHR = user.role !== "EMPLOYEE";
  const employeeId = id || user.employeeId;
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);

  function load() {
    setLoading(true);
    const query = new URLSearchParams();
    if (employeeFilter) query.set("employeeId", employeeFilter);
    if (statusFilter) query.set("status", statusFilter);
    const request = isHR && !id ? api(`/attendance?${query}`) : api(`/employees/${employeeId}/attendance`);
    request.then(setRecords).catch((e) => alert(e.message)).finally(() => setLoading(false));
  }

  useEffect(() => {
    if (isHR && !id) api("/employees").then(setEmployees).catch((e) => alert(e.message));
  }, [isHR, id]);
  useEffect(load, [employeeId, employeeFilter, statusFilter, isHR, id]);

  const openRecord = records.find((record) => !record.checkOut);
  async function toggleClock() {
    setBusy(true);
    try {
      await api(openRecord ? `/attendance/${openRecord.id}/check-out` : "/attendance/check-in", { method: "POST" });
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveCorrection(event) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      await api(`/attendance/${editing.id}`, {
        method: "PATCH",
        body: { checkIn: form.get("checkIn"), checkOut: form.get("checkOut") || null, status: form.get("status") },
      });
      setEditing(null);
      load();
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>{id ? "Employee Attendance" : isHR ? "Attendance" : "My Attendance"}</h1>
        {!isHR && <button className="btn" disabled={busy} onClick={toggleClock}>{openRecord ? "CHECK OUT" : "CHECK IN"}</button>}
      </div>
      <p className="page-sub">{isHR ? "Review worked hours and correct attendance records when needed." : "Record your working time and keep track of completed days."}</p>
      {isHR && !id && (
        <div className="toolbar">
          <select className="toolbar-select" value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)}>
            <option value="">All employees</option>
            {employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.name}</option>)}
          </select>
          <select className="toolbar-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All status</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
        </div>
      )}
      {loading ? <p className="muted">Loading…</p> : (
        <table className="table">
          <thead><tr>{isHR && !id && <th>Employee</th>}<th>Check in</th><th>Check out</th><th>Worked hours</th><th>Status</th>{isHR && <th />}</tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                {isHR && !id && <td>{record.employee?.name}</td>}
                <td>{formatDate(record.checkIn)}</td>
                <td>{formatDate(record.checkOut)}</td>
                <td>{record.workedHours == null ? "Open" : `${Number(record.workedHours).toFixed(2)} h`}</td>
                <td><span className={`badge badge-${record.status.toLowerCase()}`}>{STATUS_LABEL[record.status] || record.status}</span></td>
                {isHR && <td><button className="btn btn-secondary btn-sm" onClick={() => setEditing(record)}>Correct</button></td>}
              </tr>
            ))}
            {!records.length && <tr><td colSpan={isHR ? 6 : 5} className="muted">No attendance records.</td></tr>}
          </tbody>
        </table>
      )}
      {editing && (
        <div className="modal-backdrop">
          <div className="modal">
            <div className="modal-header"><h2>Correct attendance</h2><button className="modal-close" onClick={() => setEditing(null)}>×</button></div>
            <form onSubmit={saveCorrection}>
              <label>Check in<input name="checkIn" type="datetime-local" defaultValue={toInputDate(editing.checkIn)} required /></label>
              <label>Check out<input name="checkOut" type="datetime-local" defaultValue={toInputDate(editing.checkOut)} /></label>
              <label>Status<select name="status" defaultValue={editing.status}>{Object.entries(STATUS_LABEL).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
              <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button><button className="btn" disabled={busy}>Save correction</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function toInputDate(value) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
