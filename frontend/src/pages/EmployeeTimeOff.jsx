import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import AllocationForm from "../components/AllocationForm";
import { AllocRows, fmtDate } from "../components/AllocationTable";

export default function EmployeeTimeOff() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [emp, setEmp] = useState(null);
  const [data, setData] = useState({ allocations: [], requests: [] });
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    Promise.all([
      api(`/employees/${id}`),
      api(`/employees/${id}/time-off`),
    ])
      .then(([e, t]) => {
        setEmp(e);
        setData(t);
      })
      .catch((err) => alert(err.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [id]);

  if (loading) return <p className="muted">Loading…</p>;
  if (!emp) return <p className="muted">Employee not found.</p>;

  return (
    <div>
      <div className="page-header">
        <button className="btn btn-secondary" onClick={() => navigate(`/employees/${id}`)}>← Back</button>
        <h1>{emp.name} · Time Off</h1>
        <button className="btn" onClick={() => setShowForm(true)}>ALLOCATE LEAVE</button>
      </div>

      <div className="card">
        <h3>Balances</h3>
        {data.allocations.length === 0 ? (
          <p className="muted">No allocations yet for this employee.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Quota</th>
                <th>Remaining</th>
                <th>Validity</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.allocations.map((a) => (
                <tr key={a.id}>
                  <td>{a.timeOffType?.name}</td>
                  <td><strong>{Number(a.quota)}</strong> {a.timeOffType?.unit === "HOURS" ? "hrs" : "days"}</td>
                  <td><strong>{Number(a.remaining)}</strong> {a.timeOffType?.unit === "HOURS" ? "hrs" : "days"}</td>
                  <td>{fmtDate(a.validFrom)} → {fmtDate(a.validTo)}</td>
                  <td>
                    {a.approvedByHR ? (
                      <span className="status-pill">Approved</span>
                    ) : (
                      <span className="status-pill amber">Pending OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card">
        <h3>Requests</h3>
        {data.requests.length === 0 ? (
          <p className="muted">No requests yet.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Dates</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.requests.map((r) => (
                <tr key={r.id}>
                  <td>{r.timeOffType?.name}</td>
                  <td>{fmtDate(r.startDate)} → {fmtDate(r.endDate)}</td>
                  <td><span className={"badge " + (r.status === "APPROVED" ? "badge-active" : r.status === "REFUSED" ? "badge-inactive" : "")}>{r.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <AllocationForm
          employee={emp}
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