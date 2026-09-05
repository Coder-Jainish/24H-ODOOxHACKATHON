import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";

const CAT_PILL = {
  BASIC: "cat-basic",
  ALLOWANCE: "cat-allowance",
  GROSS: "cat-gross",
  DEDUCTION: "cat-deduction",
  NET: "cat-net",
};

const DELIVERY_PILL = {
  PENDING: "dlv-pending",
  SENT: "dlv-sent",
  FAILED: "dlv-failed",
};

const STATE_PILL = {
  DRAFT: "stone",
  COMPUTED: "computed",
  VALIDATED: "validated",
  PAID: "paid",
  CLOSED: "closed",
};

export default function PayslipDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [payslip, setPayslip] = useState(null);

  useEffect(() => {
    api(`/payslips/${id}`)
      .then(setPayslip)
      .catch((e) => alert(e.message));
  }, [id]);

  if (!payslip) return <p className="muted">Loading…</p>;

  const lines = payslip.lines || [];
  const basic = lines.filter((l) => l.category === "BASIC");
  const allowances = lines.filter((l) => l.category === "ALLOWANCE");
  const deductions = lines.filter((l) => l.category === "DEDUCTION");
  const net = lines.filter((l) => l.category === "NET");
  const batch = payslip.payrunBatch;

  function money(n) {
    return "₹" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  return (
    <div>
      <button className="btn btn-secondary btn-sm back-btn" onClick={() => navigate(payslip.payrunBatchId ? `/payruns/${payslip.payrunBatchId}` : "/payslips")}>
        ← Back to Payrun
      </button>

      <div className="page-header">
        <h1>{payslip.employee?.name}</h1>
        <div className="row-actions">
          {batch && <span className={"status-pill status-pill-sa " + (STATE_PILL[batch.state] || "grey")}>{batch.state}</span>}
          <span className={"status-pill status-pill-sa " + (DELIVERY_PILL[payslip.deliveryStatus] || "dlv-pending")}>
            {payslip.deliveryStatus || "PENDING"}
          </span>
        </div>
      </div>

      <div className="card meta-card" style={{ marginBottom: "1rem" }}>
        <div className="meta-grid">
          <MetaItem label="Employee" value={`${payslip.employee?.name} · ${payslip.employee?.jobPosition}`} />
          {batch && <MetaItem label="Period" value={`${fmtDate(batch.periodStart)} → ${fmtDate(batch.periodEnd)}`} />}
          {batch?.salaryStructure && <MetaItem label="Structure" value={batch.salaryStructure.name} />}
          <MetaItem label="Gross" value={money(payslip.grossTotal)} />
          <MetaItem label="Deductions" value={money(payslip.deductionTotal)} />
          <MetaItem label="Net Pay" value={money(payslip.netTotal)} />
        </div>
      </div>

      <h3 className="section-title">Payslip Breakdown</h3>
      <div className="card">
        {basic.length > 0 && (
          <div className="pay-section">
            <h4 className="pay-section-title">Basic Earnings</h4>
            {basic.map((l) => (
              <div key={l.id} className="pay-line">
                <span><span className={"status-pill " + (CAT_PILL[l.category] || "cat-basic")}>{l.category}</span> {l.salaryRule?.name || l.salaryRule?.code}</span>
                <span className="pay-amount">{money(l.amount)}</span>
              </div>
            ))}
          </div>
        )}

        {allowances.length > 0 && (
          <div className="pay-section">
            <h4 className="pay-section-title">Allowances</h4>
            {allowances.map((l) => (
              <div key={l.id} className="pay-line">
                <span><span className={"status-pill " + (CAT_PILL[l.category] || "cat-allowance")}>{l.category}</span> {l.salaryRule?.name || l.salaryRule?.code}</span>
                <span className="pay-amount">{money(l.amount)}</span>
              </div>
            ))}
            <div className="pay-line">
              <span className="pay-total">Gross</span>
              <span className="pay-total">{money(payslip.grossTotal)}</span>
            </div>
          </div>
        )}

        {deductions.length > 0 && (
          <div className="pay-section">
            <h4 className="pay-section-title">Deductions</h4>
            {deductions.map((l) => (
              <div key={l.id} className="pay-line">
                <span><span className={"status-pill " + (CAT_PILL[l.category] || "cat-deduction")}>{l.category}</span> {l.salaryRule?.name || l.salaryRule?.code}</span>
                <span className="pay-amount">{money(l.amount)}</span>
              </div>
            ))}
            <div className="pay-line">
              <span className="pay-total">Total Deductions</span>
              <span className="pay-total">{money(payslip.deductionTotal)}</span>
            </div>
          </div>
        )}

        {net.length > 0 &&
          net.map((l) => (
            <div key={l.id} className="pay-line">
              <span className="pay-total">Net Take-Home</span>
              <span className="pay-total">{money(l.amount)}</span>
            </div>
          ))}
        {net.length === 0 && (
          <div className="pay-line">
            <span className="pay-total">Net Take-Home</span>
            <span className="pay-total">{money(payslip.netTotal)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function MetaItem({ label, value }) {
  return (
    <div className="meta-item">
      <span className="meta-label">{label}</span>
      <span className="meta-value">{value}</span>
    </div>
  );
}