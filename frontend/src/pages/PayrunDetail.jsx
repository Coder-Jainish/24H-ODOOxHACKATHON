import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";

const STATE_PILL = {
  DRAFT: "stone",
  COMPUTED: "computed",
  VALIDATED: "validated",
  PAID: "paid",
  CLOSED: "closed",
};

// Validate / Mark Paid are HPM/ADM actions (API.md §10); HPU can compute but not approve.
const ACTION_ROLES = ["HR_PAYROLL_MANAGER", "ADMIN"];

export default function PayrunDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [batch, setBatch] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [busy, setBusy] = useState(null);

  function reload() {
    api(`/payruns/${id}`)
      .then((b) => {
        setBatch(b);
        return api(`/payruns/${id}/warnings`);
      })
      .then(setWarnings)
      .catch((e) => {
        alert(e.message);
        setBusy(null);
      });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function run(action) {
    setBusy(action);
    try {
      await api(`/payruns/${id}/${action}`, { method: "POST" });
      reload();
    } catch (err) {
      alert(err.message);
      setBusy(null);
    }
  }

  function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  if (!batch) return <p className="muted">Loading…</p>;

  const canAction = ACTION_ROLES.includes(user?.role);
  const { state } = batch;
  const netTotal = batch.payslips.reduce((s, p) => s + Number(p.netTotal || 0), 0);

  return (
    <div>
      <button className="btn btn-secondary btn-sm back-btn" onClick={() => navigate("/payruns")}>← Back to Payruns</button>

      <div className="page-header">
        <h1>Payrun</h1>
        <div className="row-actions">
          <span className={"status-pill status-pill-sa " + (STATE_PILL[state] || "grey")}>{state}</span>
          {state === "DRAFT" && (
            <button className="btn status-pill-sa" disabled={!!busy} onClick={() => run("compute")}>
              {busy === "compute" ? "Computing…" : "Compute Payslips"}
            </button>
          )}
          {state === "COMPUTED" && canAction && (
            <button className="btn status-pill-sa" disabled={!!busy} onClick={() => run("validate")}>
              {busy === "validate" ? "Validating…" : "Validate"}
            </button>
          )}
          {state === "VALIDATED" && canAction && (
            <button className="btn status-pill-sa" disabled={!!busy} onClick={() => run("mark-paid")}>
              {busy === "mark-paid" ? "Marking…" : "Mark Paid"}
            </button>
          )}
          {(state === "PAID" || state === "CLOSED") && (
            <span className="status-pill">Pay slips locked</span>
          )}
        </div>
      </div>

      <div className="card meta-card" style={{ marginBottom: "1rem" }}>
        <div className="meta-grid">
          <MetaItem label="Period" value={`${fmtDate(batch.periodStart)} → ${fmtDate(batch.periodEnd)}`} />
          <MetaItem label="Structure" value={batch.salaryStructure?.name || "—"} />
          {batch.computedAt && <MetaItem label="Computed" value={fmtDate(batch.computedAt)} />}
          {batch.validatedAt && <MetaItem label="Validated" value={fmtDate(batch.validatedAt)} />}
          {batch.paidAt && <MetaItem label="Paid" value={fmtDate(batch.paidAt)} />}
          <MetaItem label="Net Total" value={"₹" + netTotal.toLocaleString()} />
        </div>
      </div>

      {warnings.length > 0 && (
        <div className="card" style={{ marginBottom: "1rem", borderColor: "#ffc107" }}>
          <h3>⚠️ Validation Warnings</h3>
          <ul className="warn-list">
            {warnings.map((w, i) => (
              <li key={i}>{w.message}</li>
            ))}
          </ul>
        </div>
      )}
      {warnings.length === 0 && state === "COMPUTED" && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h3>Validation</h3>
          <p className="muted">No warnings — this batch is clean and ready to validate.</p>
        </div>
      )}

      <h3 className="section-title">Payslips ({batch.payslips.length})</h3>
      <table className="table">
        <thead>
          <tr>
            <th>Employee</th>
            <th>Department</th>
            <th>Contract</th>
            <th className="num">Gross</th>
            <th className="num">Deductions</th>
            <th className="num">Net</th>
            <th className="num">Lines</th>
          </tr>
        </thead>
        <tbody>
          {batch.payslips.map((p) => (
            <tr key={p.id} className="clickable-row" onClick={() => navigate(`/payslips/${p.id}`)}>
              <td>
                <strong>{p.employee?.name}</strong>
                <div className="muted small">{p.employee?.jobPosition}</div>
              </td>
              <td>{p.employee?.department}</td>
              <td>
                {p.contractId ? (
                  <span className="status-pill">Active</span>
                ) : (
                  <span className="status-pill amber">Missing</span>
                )}
              </td>
              <td className="num">₹{Number(p.grossTotal || 0).toLocaleString()}</td>
              <td className="num">₹{Number(p.deductionTotal || 0).toLocaleString()}</td>
              <td className="num"><strong>₹{Number(p.netTotal || 0).toLocaleString()}</strong></td>
              <td className="num">{p.lines?.length ?? 0}</td>
            </tr>
          ))}
          {batch.payslips.length === 0 && (
            <tr>
              <td colSpan={7} className="muted">No employees in this payrun yet.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// Label/value pair used by the batch meta strip.
function MetaItem({ label, value }) {
  return (
    <div className="meta-item">
      <span className="meta-label">{label}</span>
      <span className="meta-value">{value}</span>
    </div>
  );
}