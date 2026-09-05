import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function TimeOffTypes() {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  function load() {
    setLoading(true);
    api("/time-off/types").then(setTypes).catch((e) => alert(e.message)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div>
      <div className="page-header">
        <h1>Time Off Types</h1>
        <button className="btn" onClick={() => { setEditing(null); setShowForm(true); }}>
          NEW
        </button>
      </div>
      <p className="page-sub">Define the leave policies — days vs hours, whether they track a balance, and whether requests need approval.</p>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Unit</th>
              <th>Allocation</th>
              <th>Approval</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.unit === "DAYS" ? "Days" : "Hours"}</td>
                <td>{t.tracksBalance ? <span className="status-pill">Required</span> : <span className="status-pill grey">No</span>}</td>
                <td>{t.requiresApproval ? <span className="status-pill">Requires approval</span> : <span className="status-pill grey">No approval</span>}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(t); setShowForm(true); }}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {types.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">No time off types yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showForm && (
        <TypeForm
          type={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}
    </div>
  );
}

function TypeForm({ type, onClose, onSaved }) {
  const isEdit = !!type;
  const [form, setForm] = useState({
    name: type?.name || "",
    unit: type?.unit || "DAYS",
    requiresApproval: type?.requiresApproval ?? true,
    tracksBalance: type?.tracksBalance ?? true,
  });
  const [busy, setBusy] = useState(false);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (isEdit) await api(`/time-off/types/${type.id}`, { method: "PATCH", body: form });
      else await api("/time-off/types", { method: "POST", body: form });
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
          <h3>{isEdit ? "Edit Time Off Type" : "New Time Off Type"}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            Type Name
            <input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. Annual Leave" required />
          </label>
          <label>
            Unit
            <select value={form.unit} onChange={(e) => update("unit", e.target.value)}>
              <option value="DAYS">Days</option>
              <option value="HOURS">Hours</option>
            </select>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={form.tracksBalance} onChange={(e) => update("tracksBalance", e.target.checked)} />
            Tracks balance (deducts from allocation)
          </label>
          <label className="check-row">
            <input type="checkbox" checked={form.requiresApproval} onChange={(e) => update("requiresApproval", e.target.checked)} />
            Requires approval
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}