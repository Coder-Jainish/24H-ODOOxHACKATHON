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
  // Every staff role clocks in/out for themselves; only HR Manager/Admin review all.
  const isReviewer = ["HR_MANAGER", "ADMIN"].includes(user.role);
  const employeeId = id || user.employeeId;
  const [records, setRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null);
  const [openRecord, setOpenRecord] = useState(null);
  const [todayDone, setTodayDone] = useState(false);

  function load() {
    setLoading(true);
    const query = new URLSearchParams();
    if (employeeFilter) query.set("employeeId", employeeFilter);
    if (statusFilter) query.set("status", statusFilter);
    const request = isReviewer && !id ? api(`/attendance?${query}`) : api(`/employees/${employeeId}/attendance`);
    request.then(setRecords).catch((e) => alert(e.message)).finally(() => setLoading(false));
  }

  // Resolve the caller's OWN day state so any role can clock in/out — and only once per day.
  useEffect(() => {
    api(`/employees/${user.employeeId}/attendance`)
      .then((mine) => {
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const todays = mine.filter((record) => new Date(record.checkIn) >= startOfDay);
        setOpenRecord(todays.find((record) => !record.checkOut) || null);
        setTodayDone(todays.length > 0 && todays.every((record) => record.checkOut));
      })
      .catch(() => { setOpenRecord(null); setTodayDone(false); });
  }, [user.employeeId]);

  useEffect(() => {
    if (isReviewer && !id) api("/employees").then(setEmployees).catch((e) => alert(e.message));
  }, [isReviewer, id]);
  useEffect(load, [employeeId, employeeFilter, statusFilter, isReviewer, id]);
  async function toggleClock() {
    const action = openRecord ? "out" : "in";
    if (!window.confirm(`Are you sure you want to check ${action}?`)) return;
    setBusy(true);
    try {
      if (openRecord) {
        await api(`/attendance/${openRecord.id}/check-out`, { method: "POST" });
        setOpenRecord(null);
        setTodayDone(true);
      } else {
        const record = await api("/attendance/check-in", { method: "POST" });
        setOpenRecord(record);
        setTodayDone(false);
      }
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
        <h1>{id ? "Employee Attendance" : isReviewer ? "Attendance" : "My Attendance"}</h1>
        {!id && <button className="btn" disabled={busy || (todayDone && !openRecord)} onClick={toggleClock}>
          {openRecord ? "CHECK OUT" : todayDone ? "DONE TODAY" : "CHECK IN"}
        </button>}
      </div>
      <p className="page-sub">{isReviewer ? "Review worked hours and correct attendance records when needed." : "Record your working time and keep track of completed days."}</p>
      {isReviewer && !id && (
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
          <thead><tr>{isReviewer && !id && <th>Employee</th>}<th>Check in</th><th>Check out</th><th>Worked hours</th><th>Status</th>{isReviewer && <th />}</tr></thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id}>
                {isReviewer && !id && <td>{record.employee?.name}</td>}
                <td>{formatDate(record.checkIn)}</td>
                <td>{formatDate(record.checkOut)}</td>
                <td>{record.workedHours == null ? "Open" : `${Number(record.workedHours).toFixed(2)} h`}</td>
                <td><span className={`badge badge-${record.status.toLowerCase()}`}>{STATUS_LABEL[record.status] || record.status}</span></td>
                {isReviewer && <td><button className="btn btn-secondary btn-sm" onClick={() => setEditing(record)}>Correct</button></td>}
              </tr>
            ))}
            {!records.length && <tr><td colSpan={isReviewer ? 6 : 5} className="muted">No attendance records.</td></tr>}
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
