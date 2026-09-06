import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";

export default function SalaryStructures() {
  const { user } = useAuth();
  const canManage = ["HR_PAYROLL_MANAGER", "ADMIN"].includes(user?.role);
  const [structures, setStructures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  function load() {
    setLoading(true);
    api("/salary-structures").then(setStructures).catch((e) => alert(e.message)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  async function del(s) {
    if (!window.confirm(`Delete structure "${s.name}"?`)) return;
    try {
      await api(`/salary-structures/${s.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Salary Structures</h1>
        {canManage && (
          <button className="btn" onClick={() => { setEditing(null); setShowForm(true); }}>NEW</button>
        )}
      </div>
      <p className="page-sub">Structures group the salary rules that make up a payslip (e.g. Basic, HRA, deductions, Net). Contracts reference a structure to compute pay.</p>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Structure</th>
              <th>Rules</th>
              <th>Used by Contracts</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {structures.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td><span className="status-pill">{s._count.rules} rules</span></td>
                <td className="muted">{s._count.contracts}</td>
                <td>{canManage && (
                  <span className="row-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(s); setShowForm(true); }}>Edit</button>
                    <button className="btn btn-secondary btn-sm refuse-btn" onClick={() => del(s)}>Delete</button>
                  </span>
                )}</td>
              </tr>
            ))}
            {structures.length === 0 && (
              <tr>
                <td colSpan={4} className="muted">No structures yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showForm && (
        <StructureForm
          structure={editing}
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

function StructureForm({ structure, onClose, onSaved }) {
  const [name, setName] = useState(structure?.name || "");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      if (structure) await api(`/salary-structures/${structure.id}`, { method: "PATCH", body: { name } });
      else await api("/salary-structures", { method: "POST", body: { name } });
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
          <h3>{structure ? "Edit Structure" : "New Structure"}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            Structure Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Regular Full-Time" required />
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