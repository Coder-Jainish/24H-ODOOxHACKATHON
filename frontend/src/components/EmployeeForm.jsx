import { useEffect, useState } from "react";
import { api } from "../lib/api";

export default function EmployeeForm({ onClose, onSaved, employee }) {
  const [form, setForm] = useState({
    name: employee?.name || "",
    email: employee?.email || "",
    department: employee?.department || "",
    jobPosition: employee?.jobPosition || "",
    managerId: employee?.managerId || "",
  });
  const [managers, setManagers] = useState([]);
  const [busy, setBusy] = useState(false);
  const isEdit = !!employee;

  useEffect(() => {
    api("/employees").then((list) => setManagers(list.filter((e) => e.id !== employee?.id))).catch(() => {});
  }, [employee]);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, managerId: form.managerId || null };
      if (isEdit) await api(`/employees/${employee.id}`, { method: "PATCH", body: payload });
      else await api("/employees", { method: "POST", body: payload });
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
          <h3>{isEdit ? "Edit Employee" : "New Employee"}</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            Name
            <input value={form.name} onChange={(e) => update("name", e.target.value)} required />
          </label>
          <label>
            Work Email
            <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)} required />
          </label>
          <label>
            Department
            <input value={form.department} onChange={(e) => update("department", e.target.value)} required />
          </label>
          <label>
            Job Position
            <input value={form.jobPosition} onChange={(e) => update("jobPosition", e.target.value)} required />
          </label>
          <label>
            Manager
            <select value={form.managerId} onChange={(e) => update("managerId", e.target.value)}>
              <option value="">— None —</option>
              {managers.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </label>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button className="btn" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}