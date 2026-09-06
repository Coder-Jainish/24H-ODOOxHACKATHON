import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import ContractForm from "../components/ContractForm";

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }) : "—");

export default function Contracts() {
  const navigate = useNavigate();
  const { id } = useParams(); // when rendered as /employees/:id/contracts
  const employeeId = id || null;

  const [contracts, setContracts] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  function load() {
    setLoading(true);
    const q = employeeId ? `?employeeId=${employeeId}` : "";
    api("/contracts" + q).then(setContracts).catch((e) => alert(e.message)).finally(() => setLoading(false));
  }

  useEffect(load, [employeeId]);

  useEffect(() => {
    if (employeeId) {
      api(`/employees/${employeeId}`).then(setEmployee).catch(() => {});
    }
  }, [employeeId]);

  return (
    <div>
      <div className="page-header">
        <div>
          {employeeId && (
            <button className="btn btn-secondary back-btn" onClick={() => navigate(`/employees/${employeeId}`)}>
              ← {employee?.name || "Employee"}
            </button>
          )}
          <h1>Contracts{employee ? ` — ${employee.name}` : ""}</h1>
        </div>
        <button className="btn" onClick={() => { setEditing(null); setShowForm(true); }}>
          NEW
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Contract</th>
              <th>Employee</th>
              <th>Start</th>
              <th>End</th>
              <th>Wage / Month</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contracts.map((c) => {
              const running = c.status === "ACTIVE";
              return (
                <tr key={c.id} className={running ? "row-running" : ""}>
                  <td>
                    <span className="contract-ref">CON/{new Date(c.startDate).getFullYear()}/{String(c.id).slice(0, 4).toUpperCase()}</span>
                    {running && <span className="badge badge-running active-badge">Running</span>}
                  </td>
                  <td>{employeeId ? "" : c.employee?.name}</td>
                  <td>{fmtDate(c.startDate)}</td>
                  <td>{fmtDate(c.endDate)}</td>
                  <td>₹{Number(c.wage).toLocaleString("en-IN")}</td>
                  <td>
                    <span className={"badge " + (running ? "badge-running" : "badge-expired")}>
                      {c.status === "ACTIVE" ? "Running" : c.status === "DRAFT" ? "Draft" : c.status}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(c); setShowForm(true); }}>
                      Edit
                    </button>
                  </td>
                </tr>
              );
            })}
            {contracts.length === 0 && (
              <tr>
                <td colSpan={7} className="muted">
                  No contracts found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showForm && (
        <ContractForm
          employeeId={employeeId}
          contract={editing}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}