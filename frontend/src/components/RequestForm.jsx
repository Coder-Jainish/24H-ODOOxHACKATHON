import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function RequestForm({ allocations, onClose, onSaved }) {
  const [form, setForm] = useState({
    timeOffTypeId: "",
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    reason: "",
  });
  const [busy, setBusy] = useState(false);

  // Only types the employee has an allocation for (skip alloc-less, so balance is avail)
  const spendable = allocations.filter((a) => a.approvedByHR);

  useEffect(() => {
    if (spendable.length && !form.timeOffTypeId) {
      setForm((f) => ({ ...f, timeOffTypeId: spendable[spendable.length - 1]?.timeOffTypeId }));
    }
  }, []);

  function selected() {
    return spendable.find((a) => a.timeOffTypeId === form.timeOffTypeId);
  }

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/time-off/requests", { method: "POST", body: form });
      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (spendable.length === 0) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>New Request</h3>
            <button className="modal-close" onClick={onClose}>×</button>
          </div>
          <p className="muted">You don't have any approved leave balance to request against. Ask HR to allocate leave.</p>
          <div className="modal-actions">
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New Time Off Request</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            Leave Type
            <select value={form.timeOffTypeId} onChange={(e) => update("timeOffTypeId", e.target.value)} required>
              {spendable.map((a) => (
                <option key={a.id} value={a.timeOffTypeId}>
                  {a.timeOffType?.name} — {Number(a.remaining)} {a.timeOffType?.unit === "HOURS" ? "hrs" : "days"} left
                </option>
              ))}
            </select>
          </label>
          <label>
            From
            <input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} required />
          </label>
          <label>
            To
            <input type="date" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} required />
          </label>
          <label>
            Reason <span className="muted">(optional)</span>
            <input value={form.reason} onChange={(e) => update("reason", e.target.value)} placeholder="e.g. Family function" />
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn" disabled={busy}>{busy ? "Submitting…" : "Submit"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}