import { useEffect, useState } from "react";
import { api } from "../lib/api";
import AllocationForm from "../components/AllocationForm";
import { AllocRows } from "../components/AllocationTable";

export default function Allocations() {
  const [allocations, setAllocations] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [filters, setFilters] = useState({ employeeId: "", timeOffTypeId: "" });

  function load() {
    setLoading(true);
    const q = new URLSearchParams();
    if (filters.employeeId) q.set("employeeId", filters.employeeId);
    if (filters.timeOffTypeId) q.set("timeOffTypeId", filters.timeOffTypeId);
    api(`/time-off/allocations${q.toString() ? `?${q}` : ""}`)
      .then(setAllocations)
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    api("/employees").then(setEmployees).catch(() => {});
    api("/time-off/types").then(setTypes).catch(() => {});
  }, []);

  useEffect(load, [filters.employeeId, filters.timeOffTypeId]);

  return (
    <div>
      <div className="page-header">
        <h1>Time Off Allocations</h1>
        <button className="btn" onClick={() => { setEditing(null); setShowForm(true); }}>NEW</button>
      </div>
      <p className="page-sub">
        Grant yearly leave balances to employees (e.g. 20 PTO days for the year). These balances are what employees spend time off against — separate from their individual day-off requests.
      </p>

      <div className="toolbar">
        <select value={filters.employeeId} onChange={(e) => setFilters((f) => ({ ...f, employeeId: e.target.value }))}>
          <option value="">All Employees</option>
          {employees.map((em) => (
            <option key={em.id} value={em.id}>{em.name}</option>
          ))}
        </select>
        <select value={filters.timeOffTypeId} onChange={(e) => setFilters((f) => ({ ...f, timeOffTypeId: e.target.value }))}>
          <option value="">All Types</option>
          {types.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Type</th>
              <th>Quota</th>
              <th>Remaining</th>
              <th>Validity</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <AllocRows allocations={allocations} onEdit={(a) => { setEditing(a); setShowForm(true); }} />
            {allocations.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">No allocations yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showForm && (
        <AllocationForm
          allocation={editing}
          onClose={() => {
            setShowForm(false);
            setEditing(null);
          }}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}