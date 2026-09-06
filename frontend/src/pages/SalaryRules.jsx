import { useEffect, useState } from "react";
import { api } from "../lib/api";

const CATS = ["BASIC", "ALLOWANCE", "GROSS", "DEDUCTION", "NET"];
const CALC_TYPES = ["FIXED", "PERCENTAGE", "FORMULA"];

export default function SalaryRules() {
  const [structures, setStructures] = useState([]);
  const [structureId, setStructureId] = useState("");
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewing, setPreviewing] = useState(false);

  function load() {
    setLoading(true);
    const q = structureId ? `?salaryStructureId=${structureId}` : "";
    api(`/salary-rules${q}`).then(setRules).catch((e) => alert(e.message)).finally(() => setLoading(false));
  }

  useEffect(() => {
    api("/salary-structures").then((s) => {
      setStructures(s);
      if (!structureId && s.length) setStructureId(s[0].id);
    }).catch(() => {});
  }, []);

  useEffect(load, [structureId]);

  async function runPreview() {
    if (!preview?.employeeId) return alert("Select an employee first.");
    setPreviewing(true);
    try {
      const res = await api("/salary-rules/preview", { method: "POST", body: { salaryStructureId: structureId, employeeId: preview.employeeId, periodStart: preview.start, periodEnd: preview.end } });
      setPreview((p) => ({ ...p, result: res }));
    } catch (err) {
      alert(err.message);
    } finally {
      setPreviewing(false);
    }
  }

  async function del(rule) {
    if (!window.confirm(`Delete rule "${rule.name}"?`)) return;
    try {
      await api(`/salary-rules/${rule.id}`, { method: "DELETE" });
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>Salary Rules</h1>
        <button className="btn" onClick={() => { setEditing(null); setShowForm(true); }}>NEW</button>
      </div>
      <p className="page-sub">Rules define each payslip line. They run in sequence order — later rules can reference earlier ones by code (e.g. a FIXED Basic, then HRA as a % of it, a deduction, and a Net formula).</p>

      <div className="toolbar">
        <select value={structureId} onChange={(e) => setStructureId(e.target.value)}>
          <option value="">All structures</option>
          {structures.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Seq</th>
              <th>Name / Code</th>
              <th>Category</th>
              <th>Calculation</th>
              <th>Amount</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id}>
                <td><span className="seq-badge">{r.sequence}</span></td>
                <td>
                  <strong>{r.name}</strong> <span className="code-chip">{r.code}</span>
                  <div className="muted small">{r.salaryStructure?.name}</div>
                </td>
                <td><span className={"status-pill cat-" + r.category.toLowerCase()}>{r.category}</span></td>
                <td className="muted">
                  {r.calculationType === "PERCENTAGE" ? `${r.value}% of ${r.baseRuleCode || "?"}` : r.calculationType === "FORMULA" ? r.formula : r.calculationType}
                </td>
                <td>{r.calculationType === "FIXED" ? `₹${Number(r.value).toLocaleString()}` : "—"}</td>
                <td>
                  <span className="row-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(r); setShowForm(true); }}>Edit</button>
                    <button className="btn btn-secondary btn-sm refuse-btn" onClick={() => del(r)}>Delete</button>
                  </span>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">No rules for this structure yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {structureId && (
        <div className="card preview-card">
          <h3>Preview Payslip</h3>
          <div className="preview-controls">
            <label className="preview-employee">
              Employee
              <EmployeeSelect value={preview?.employeeId || ""} onChange={(v) => setPreview((p) => ({ ...p, employeeId: v }))} />
            </label>
            <label>
              Period Start
              <input type="date" value={preview?.start || "2026-03-01"} onChange={(e) => setPreview((p) => ({ ...p, start: e.target.value }))} />
            </label>
            <label>
              Period End
              <input type="date" value={preview?.end || "2026-03-31"} onChange={(e) => setPreview((p) => ({ ...p, end: e.target.value }))} />
            </label>
            <button className="btn" disabled={previewing} onClick={runPreview}>{previewing ? "Computing…" : "Compute"}</button>
          </div>
          {preview?.result && (
            <div className="preview-result">
              <div className="preview-meta">
                <strong>{preview.result.employee?.name || "Payslip"} — {preview.result.structure?.name}</strong>
                <span className="muted small">Contract wage used: {preview.result.contract?.wage != null ? `₹${Number(preview.result.contract.wage).toLocaleString("en-IN")}` : "—"}</span>
              </div>
              <table className="table compact">
                <thead>
                  <tr><th>Rule (executed in sequence)</th><th>Category</th><th>Amount</th></tr>
                </thead>
                <tbody>
                  {preview.result.lines.map((l, i) => (
                    <tr key={i}>
                      <td>
                        <div>{l.name} <span className="code-chip">{l.code}</span></div>
                        <div className="calc-explanation">{l.explanation}</div>
                      </td>
                      <td>{l.category}</td>
                      <td>₹{l.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                  <tr className="preview-total">
                    <td>Gross</td><td></td><td>₹{preview.result.gross.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="preview-total">
                    <td>Deductions</td><td></td><td>₹{preview.result.deductions.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                  <tr className="preview-total">
                    <td><strong>Net</strong></td><td></td><td><strong>₹{preview.result.totals.NET != null ? Number(preview.result.totals.NET).toLocaleString(undefined, { minimumFractionDigits: 2 }) : "—"}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showForm && (
        <RuleForm
          structureId={structureId}
          structures={structures}
          rule={editing}
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

function EmployeeSelect({ value, onChange }) {
  const [employees, setEmployees] = useState([]);
  useEffect(() => {
    api("/employees").then(setEmployees).catch(() => {});
  }, []);
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">— Select —</option>
      {employees.map((e) => (
        <option key={e.id} value={e.id}>{e.name}</option>
      ))}
    </select>
  );
}

function RuleForm({ structureId, structures, rule, onClose, onSaved }) {
  const [form, setForm] = useState({
    salaryStructureId: rule?.salaryStructureId || structureId,
    name: rule?.name || "",
    code: rule?.code || "",
    category: rule?.category || "BASIC",
    sequence: rule?.sequence ?? "",
    calculationType: rule?.calculationType || "FIXED",
    value: rule?.value != null ? Number(rule.value) : "",
    formula: rule?.formula || "",
    baseRuleCode: rule?.baseRuleCode || "",
  });
  const [busy, setBusy] = useState(false);

  // Codes of already-defined rules (for % base + formula hints)
  const codes = useRuleCodes(form.salaryStructureId);

  function update(k, v) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        ...form,
        sequence: Number(form.sequence),
        value: form.calculationType === "FIXED" || form.calculationType === "PERCENTAGE" ? Number(form.value) || 0 : null,
        formula: form.calculationType === "FORMULA" ? form.formula : null,
        baseRuleCode: form.calculationType === "PERCENTAGE" ? form.baseRuleCode || null : null,
      };
      if (rule) await api(`/salary-rules/${rule.id}`, { method: "PATCH", body: payload });
      else await api("/salary-rules", { method: "POST", body: payload });
      onSaved();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{rule ? "Edit Rule" : "New Rule"}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              Name
              <input value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="e.g. House Rent Allowance" required />
            </label>
            <label>
              Code
              <input value={form.code} onChange={(e) => update("code", e.target.value)} placeholder="e.g. HRA" required />
            </label>
          </div>
          <div className="form-row">
            <label>
              Structure
              <select value={form.salaryStructureId} onChange={(e) => update("salaryStructureId", e.target.value)} required>
                {structures.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
            <label>
              Category
              <select value={form.category} onChange={(e) => update("category", e.target.value)}>
                {CATS.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Sequence
              <input type="number" value={form.sequence} onChange={(e) => update("sequence", e.target.value)} placeholder="10" required />
            </label>
          </div>
          <label>
            Calculation Type
            <select value={form.calculationType} onChange={(e) => update("calculationType", e.target.value)}>
              {CALC_TYPES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          {form.calculationType !== "FORMULA" ? (
            <label>
              {form.calculationType === "PERCENTAGE" ? "Percentage (%)" : "Fixed Amount (₹)"}
              <input type="number" value={form.value} onChange={(e) => update("value", e.target.value)} required />
            </label>
          ) : (
            <label>
              Formula
              <input value={form.formula} onChange={(e) => update("formula", e.target.value)} placeholder="e.g. BASIC + HRA - PF" required />
              <span className="muted small">Use rule codes + arithmetic: {codes.length ? codes.join(", ") : "e.g. BASIC"} </span>
            </label>
          )}
          {form.calculationType === "PERCENTAGE" && (
            <label>
              Percentage of (base rule code)
              <select value={form.baseRuleCode} onChange={(e) => update("baseRuleCode", e.target.value)}>
                <option value="">— Select —</option>
                {codes.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function useRuleCodes(structureId) {
  const [codes, setCodes] = useState([]);
  useEffect(() => {
    if (!structureId) return setCodes([]);
    api(`/salary-rules?salaryStructureId=${structureId}`)
      .then((rules) => setCodes(rules.map((r) => r.code)))
      .catch(() => setCodes([]));
  }, [structureId]);
  return codes;
}