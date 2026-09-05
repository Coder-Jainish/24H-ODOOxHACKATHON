import { useEffect, useState } from "react";
import { api } from "../lib/api";

// 2-step payrun wizard (TASKS.md Step 9):
// Step 1 → period + salary structure
// Step 2 → employee selection (checkbox list with contract hint)
export default function PayrunWizard({ onClose, onCreated }) {
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);
  const [structures, setStructures] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [form, setForm] = useState({
    periodStart: firstDayOfThisMonth(),
    periodEnd: lastDayOfThisMonth(),
    salaryStructureId: "",
    employeeIds: [],
  });

  useEffect(() => {
    api("/salary-structures").then(setStructures).catch(() => {});
  }, []);

  useEffect(() => {
    if (step !== 2) return;
    Promise.all([api("/employees"), api("/contracts")])
      .then(([emps, cons]) => {
        setEmployees(emps.filter((e) => e.isActive));
        setContracts(cons);
      })
      .catch((e) => alert(e.message));
  }, [step]);

  function activeContract(employeeId) {
    const open = contracts.find((c) => c.employeeId === employeeId && c.status === "ACTIVE" && !c.endDate);
    const fixed = contracts
      .filter((c) => c.employeeId === employeeId && c.status === "ACTIVE" && c.endDate)
      .sort((a, b) => new Date(a.endDate) - new Date(b.endDate))
      .find((c) => new Date(c.endDate) >= new Date(form.periodStart));
    return open || fixed || null;
  }

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleEmployee(id) {
    setForm((f) => ({
      ...f,
      employeeIds: f.employeeIds.includes(id)
        ? f.employeeIds.filter((x) => x !== id)
        : [...f.employeeIds, id],
    }));
  }

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const batch = await api("/payruns", { method: "POST", body: form });
      onCreated(batch.id);
    } catch (err) {
      alert(err.message);
      setBusy(false);
    }
  }

  const canNext = form.periodStart && form.periodEnd && form.salaryStructureId;
  const selected = form.employeeIds;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h3>New Payrun</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </header>

        <div className="wizard-steps">
          <span className={`wizard-step ${step === 1 ? "active" : "done"}`}>1 · Period &amp; Structure</span>
          <span className={`wizard-step ${step === 2 ? "active" : ""}`}>2 · Employees</span>
        </div>

        {step === 1 && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setStep(2);
            }}
          >
            <section className="form-section">
              <h4 className="form-section-title">Payrun Period &amp; Structure</h4>
              <div className="form-row">
                <label className="field">
                  <span>Period Start</span>
                  <input type="date" value={form.periodStart} onChange={(e) => update("periodStart", e.target.value)} required />
                </label>
                <label className="field">
                  <span>Period End</span>
                  <input type="date" value={form.periodEnd} onChange={(e) => update("periodEnd", e.target.value)} required />
                </label>
              </div>
              <label className="field">
                <span>Salary Structure</span>
                <select value={form.salaryStructureId} onChange={(e) => update("salaryStructureId", e.target.value)} required>
                  <option value="">— Select —</option>
                  {structures.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </label>
            </section>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn" disabled={!canNext}>Next</button>
            </div>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={submit}>
            <p className="wizard-sub">
              Select the employees to include. Employees without an ACTIVE contract can still be
              added — the validation engine flags them on Compute.
            </p>

            <div className="emp-picker">
              <div className="emp-picker-head">
                <span>Eligible employees <em className="count-badge">{employees.length}</em></span>
                <span className="muted small">{selected.length} selected</span>
              </div>
              <div className="emp-pick-list">
                {employees.map((e) => {
                  const c = activeContract(e.id);
                  const checked = selected.includes(e.id);
                  return (
                    <label key={e.id} className="emp-pick-row">
                      <span className="emp-pick-avatar">{initials(e.name)}</span>
                      <span className="emp-pick-info">
                        <span className="emp-pick-name">{e.name}</span>
                        <span className="emp-pick-meta">{e.jobPosition} · {e.department}</span>
                      </span>
                      <span className={c ? "emp-pick-wage" : "emp-pick-wage warn"}>
                        {c ? `₹${Number(c.wage).toLocaleString()}/mo` : "No active contract"}
                      </span>
                      <input type="checkbox" checked={checked} onChange={() => toggleEmployee(e.id)} />
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button className="btn" disabled={busy || selected.length === 0}>
                {busy ? "Creating…" : `Create Draft (${selected.length})`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function firstDayOfThisMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

function lastDayOfThisMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
}

// "Aarav Mehta" → "AM", "Demo Employee" → "DE", single word → its first letter.
function initials(name = "") {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = (words[0]?.[0] || "?").toUpperCase();
  if (words.length < 2) return first;
  return first + (words[words.length - 1][0] || "?").toUpperCase();
}