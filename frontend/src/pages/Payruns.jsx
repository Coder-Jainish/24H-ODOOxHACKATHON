import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import PayrunWizard from "../components/PayrunWizard";

const STATE_PILL = {
  DRAFT: "stone",
  COMPUTED: "computed",
  VALIDATED: "validated",
  PAID: "paid",
  CLOSED: "closed",
};

export default function Payruns() {
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const navigate = useNavigate();

  function load() {
    setLoading(true);
    api("/payruns")
      .then(setBatches)
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  function fmtDate(d) {
    if (!d) return "—";
    return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div>
      <div className="page-header">
        <h1>Payruns</h1>
        <div className="row-actions">
          <span className="muted small">₹{batches.reduce((s, b) => s + Number(b.netSum || 0), 0).toLocaleString()} total paid</span>
          <button className="btn" onClick={() => setShowWizard(true)}>NEW</button>
        </div>
      </div>
      <p className="page-sub">Payroll batches: create a run for a period, pick employees, compute payslips, then validate and pay. A batch moves DRAFT → COMPUTED → VALIDATED → PAID → CLOSED.</p>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Period</th>
              <th>Structure</th>
              <th>State</th>
              <th className="num">Employees</th>
              <th className="num">Net Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {batches.map((b) => (
              <tr key={b.id}>
                <td>
                  <strong>{fmtDate(b.periodStart)}</strong>
                  <span className="muted"> → </span>
                  <strong>{fmtDate(b.periodEnd)}</strong>
                </td>
                <td>{b.salaryStructure?.name || "—"}</td>
                <td><span className={"status-pill " + (STATE_PILL[b.state] || "grey")}>{b.state}</span></td>
                <td className="num">{b._count?.payslips}</td>
                <td className="num">₹{Number(b.netSum || 0).toLocaleString()}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => navigate(`/payruns/${b.id}`)}>Open</button>
                </td>
              </tr>
            ))}
            {batches.length === 0 && (
              <tr>
                <td colSpan={6} className="muted">No payruns yet. Click NEW to create the first batch.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showWizard && (
        <PayrunWizard
          onClose={() => setShowWizard(false)}
          onCreated={(id) => {
            setShowWizard(false);
            navigate(`/payruns/${id}`);
          }}
        />
      )}
    </div>
  );
}