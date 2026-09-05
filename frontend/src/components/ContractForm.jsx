import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";

export default function ContractForm({ employeeId, onClose, onSaved }) {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [structures, setStructures] = useState([]);
  const [form, setForm] = useState({
    employeeId: employeeId || "",
    startDate: "",
    endDate: "",
    wage: "",
    department: "",
    position: "",
    salaryStructureId: user?.role === "HR_PAYROLL_USER" ? "" : "",
    status: "ACTIVE",
  });
  const [overlapMsg, setOverlapMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api("/employees").then((list) => setEmployees(list.filter((e) => e.isActive))).catch(() => {});
    api("/salary-structures").then(setStructures).catch(() => {});
  }, []);

  // Pre-select this employee's department/position when chosen, to reduce typing.
  function pickEmployee(eid) {
    const emp = employees.find((e) => e.id === eid);
    setForm((f) => ({
      ...f,
      employeeId: eid,
      department: emp?.department || f.department,
      position: emp?.jobPosition || f.position,
    }));
  }

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
    setOverlapMsg("");
  }

  // Live pre-save overlap check — surfaced in the UI before submit (API.md §2).
  async function checkOverlap() {
    if (!form.employeeId || !form.startDate) return;
    try {
      const res = await api("/contracts/validate-overlap", {
        method: "POST",
        body: {
          employeeId: form.employeeId,
          startDate: form.startDate,
          endDate: form.endDate || null,
          excludeContractId: form.excludeContractId,
        },
      });
      setOverlapMsg(res.overlap ? res.message : "");
    } catch (e) {
      setOverlapMsg(e.message);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = { ...form, wage: Number(form.wage), endDate: form.endDate || null };
      await api("/contracts", { method: "POST", body: payload });
      onSaved();
    } catch (err) {
      setOverlapMsg(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>New Contract</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            Employee
            <select value={form.employeeId} onChange={(e) => pickEmployee(e.target.value)} required disabled={!!employeeId}>
              <option value="">— Select employee —</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label>
              Start Date
              <input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} required onBlur={checkOverlap} />
            </label>
            <label>
              End Date
              <input type="date" value={form.endDate} onChange={(e) => update("endDate", e.target.value)} onBlur={checkOverlap} />
            </label>
          </div>
          <label>
            Wage / Month (₹)
            <input type="number" value={form.wage} onChange={(e) => update("wage", e.target.value)} required />
          </label>
          <div className="form-row">
            <label>
              Department
              <input value={form.department} onChange={(e) => update("department", e.target.value)} required />
            </label>
            <label>
              Job Position
              <input value={form.position} onChange={(e) => update("position", e.target.value)} required />
            </label>
          </div>
          <label>
            Salary Structure
            <select value={form.salaryStructureId} onChange={(e) => update("salaryStructureId", e.target.value)} required>
              <option value="">— Select structure —</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select value={form.status} onChange={(e) => update("status", e.target.value)}>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="EXPIRED">Expired</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </label>

          {overlapMsg && <div className="error overlap-error">⚠ {overlapMsg}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}