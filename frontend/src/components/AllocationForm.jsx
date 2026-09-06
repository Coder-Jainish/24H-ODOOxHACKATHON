import { useEffect, useState } from "react";
import { api } from "../lib/api";

// Allocation form used for BOTH creating a new grant and editing an existing one
// (no missing fields in either mode): edit prefills employee/type/quota/validity +
// the HR-approval flag; PATCH updates quota, validity and approval.
export default function AllocationForm({ employee, allocation, onClose, onSaved }) {
  const isEdit = !!allocation;
  const [types, setTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({
    employeeId: allocation?.employeeId || employee?.id || "",
    timeOffTypeId: allocation?.timeOffTypeId || "",
    quota: allocation?.quota != null ? Number(allocation.quota) : "",
    validFrom: allocation?.validFrom ? toDateInput(allocation.validFrom) : new Date().toISOString().slice(0, 10),
    validTo: allocation?.validTo ? toDateInput(allocation.validTo) : "",
    approvedByHR: allocation?.approvedByHR ?? false,
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/time-off/types").then(setTypes).catch(() => {});
    if (!employee && !allocation) api("/employees").then(setEmployees).catch(() => {});
  }, [employee, allocation]);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isEdit) {
        // Edit: quota rebase + validity + approval flag (API.md §6 PATCH).
        await api(`/time-off/allocations/${allocation.id}`, {
          method: "PATCH",
          body: {
            quota: Number(form.quota),
            validTo: form.validTo || null,
            approvedByHR: form.approvedByHR,
          },
        });
      } else {
        const payload = { ...form, quota: Number(form.quota), validTo: form.validTo || null };
        await api("/time-off/allocations", { method: "POST", body: payload });
      }
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
          <h3>{isEdit ? "Edit Time Off Allocation" : "Allocate Time Off"}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          {!employee && (
            <label>
              Employee
              <select value={form.employeeId} onChange={(e) => update("employeeId", e.target.value)} required disabled={isEdit}>
                <option value="">— Select —</option>
                {employees.map((em) => (
                  <option key={em.id} value={em.id}>{em.name}</option>
                ))}
              </select>
            </label>
          )}
          <label>
            Time Off Type
            <select value={form.timeOffTypeId} onChange={(e) => update("timeOffTypeId", e.target.value)} required disabled={isEdit}>
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
          {isEdit && (
            <label className="check-row">
              <input type="checkbox" checked={form.approvedByHR} onChange={(e) => update("approvedByHR", e.target.checked)} />
              Approved by HR (employees can spend this balance)
            </label>
          )}
          <p className="muted small">This is a balance grant (yearly quota), not a day-off request. New grants start as pending until confirmed by HR — only confirmed balances can be spent.</p>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn" disabled={busy}>{busy ? "Saving…" : isEdit ? "Save changes" : "Allocate"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// "2026-01-01T00:00:00.000Z" → "2026-01-01" (UTC-safe, avoids timezone day shift).
function toDateInput(d) {
  if (!d) return "";
  const dt = new Date(d);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`;
}