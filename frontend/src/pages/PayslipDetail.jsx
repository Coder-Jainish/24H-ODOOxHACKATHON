import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";

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

// Send is an HPM/ADM action (owner of the run); everyone else may download.
const ACTION_ROLES = ["HR_PAYROLL_MANAGER", "ADMIN"];

export default function PayslipDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
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
  const canSend = ACTION_ROLES.includes(user?.role);

  return (
    <div>
      <button className="btn btn-secondary btn-sm back-btn" onClick={() => navigate(payslip.payrunBatchId ? `/payruns/${payslip.payrunBatchId}` : "/payslips")}>
        ← Back to Payrun
      </button>

      <div className="page-header">
        <h1>{payslip.employee?.name}</h1>
        <div className="row-actions">
          {batch && <span className={"status-pill status-pill-sa " + (STATE_PILL[batch.state] || "grey")}>{batch.state}</span>}
        </div>
      </div>

      <PayslipDocument payslip={payslip} canSend={canSend} onStatus={(p) => setPayslip(p)} />

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

// The rebuilt PDF download section: document info + download / send actions with inline feedback.
function PayslipDocument({ payslip, canSend, onStatus }) {
  const [busy, setBusy] = useState(null);
  const [note, setNote] = useState(null);
  const id = payslip.id;
  const fileName = `payslip-${(payslip.employee?.name || "payslip").trim().replace(/\s+/g, "-")}.pdf`;

  // POST that returns a raw PDF blob (the api() wrapper only unwraps JSON).
  async function downloadPdf() {
    setBusy("pdf");
    setNote(null);
    try {
      const token = localStorage.getItem("pp360_token");
      const res = await fetch(`/api/payslips/${id}/pdf`, {
        method: "POST",
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error?.message || "Failed to generate PDF");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      // Safari needs a beat before the object URL is revoked or the download breaks.
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 1000);
      setNote({ kind: "ok", text: `Downloaded ${fileName} (${(blob.size / 1024).toFixed(1)} KB)` });
    } catch (err) {
      setNote({ kind: "err", text: err.message });
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    setBusy("send");
    setNote(null);
    try {
      const updated = await api(`/payslips/${id}/send`, { method: "POST" });
      onStatus(updated);
      setNote({
        kind: updated.deliveryStatus === "SENT" ? "ok" : "err",
        text:
          updated.deliveryStatus === "SENT"
            ? "Payslip dispatched to the employee."
            : "Dispatch failed — the delivery service returned an error.",
      });
    } catch (err) {
      setNote({ kind: "err", text: err.message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="card doc-card" style={{ marginBottom: "1rem" }}>
      <div className="doc-head">
        <h3 className="section-title" style={{ marginBottom: 0 }}>Payslip Document</h3>
        <span className={"status-pill " + (DELIVERY_PILL[payslip.deliveryStatus] || "dlv-pending")}>
          {payslip.deliveryStatus || "PENDING"}
        </span>
      </div>

      <div className="doc-body">
        <div className="doc-meta">
          <div className="doc-row">
            <span className="doc-label">File</span>
            <span className="doc-value mono">{fileName}</span>
          </div>
          <div className="doc-row">
            <span className="doc-label">Format</span>
            <span className="doc-value">PDF · 1 page · ₹ layout</span>
          </div>
          <div className="doc-row">
            <span className="doc-label">Generated</span>
            <span className="doc-value">{payslip.createdAt ? fmtDate(payslip.createdAt) : "—"}</span>
          </div>
        </div>

        <div className="doc-actions">
          <button className="btn" disabled={!!busy} onClick={downloadPdf}>
            {busy === "pdf" ? "Generating…" : "⬇ Download PDF"}
          </button>
          {canSend && (
            <button className="btn btn-secondary" disabled={!!busy} onClick={send}>
              {busy === "send" ? "Sending…" : "Send Payslip"}
            </button>
          )}
        </div>
      </div>

      {note && <p className={"doc-note " + note.kind}>{note.text}</p>}
    </div>
  );
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function money(n) {
  return "₹" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function MetaItem({ label, value }) {
  return (
    <div className="meta-item">
      <span className="meta-label">{label}</span>
      <span className="meta-value">{value}</span>
    </div>
  );
}