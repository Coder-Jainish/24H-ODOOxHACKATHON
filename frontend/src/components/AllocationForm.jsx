import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function AllocationForm({ employee, onClose, onSaved }) {
  const [types, setTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({
    employeeId: employee?.id || "",
    timeOffTypeId: "",
    quota: "",
    validFrom: new Date().toISOString().slice(0, 10),
    validTo: "",
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/time-off/types").then(setTypes).catch(() => {});
    if (!employee) api("/employees").then(setEmployees).catch(() => {});
  }, [employee]);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, quota: Number(form.quota), validTo: form.validTo || null };
      await api("/time-off/allocations", { method: "POST", body: payload });
      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Allocate Time Off</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {!employee && (
            <label>
              Employee
              <select value={form.employeeId} onChange={(e) => update("employeeId", e.target.value)} required>
                <option value="">— Select —</option>
                {employees.map((em) => (
                  <option key={em.id} value={em.id}>{em.name}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Time Off Type
            <select value={form.timeOffTypeId} onChange={(e) => update("timeOffTypeId", e.target.value)} required>
              <option value="">— Select —</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.unit === "HOURS" ? "hrs" : "days"})</option>
              ))}
            </select>
          </label>
          <label>
            Quota ({types.find((t) => t.id === form.timeOffTypeId)?.unit === "HOURS" ? "Hours" : "Days"})
            <input type="number" min="0.5" step="0.5" value={form.quota} onChange={(e) => update("quota", e.target.value)} required />
          </label>
          <label>
            Valid From
            <input type="date" value={form.validFrom} onChange={(e) => update("validFrom", e.target.value)} required />
          </label>
          <label>
            Valid Until <span className="muted">(optional)</span>
            <input type="date" value={form.validTo} onChange={(e) => update("validTo", e.target.value)} />
          </label>
          <p className="muted small">This is a balance grant (yearly quota), not a day-off request. New grants start as pending until confirmed by HR — only confirmed balances can be spent.</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn" disabled={busy}>{busy ? "Saving…" : "Allocate"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}