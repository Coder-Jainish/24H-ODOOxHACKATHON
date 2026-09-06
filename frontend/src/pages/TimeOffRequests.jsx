import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import RequestForm from "../components/RequestForm";
import { fmtDate } from "../components/AllocationTable";

const STATUS_LABEL = { PENDING: "Pending", APPROVED: "Approved", REFUSED: "Refused" };

export default function TimeOffRequests() {
  const { user } = useAuth();
  const isHR = user.role !== "EMPLOYEE";
  const [requests, setRequests] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState(null);
  // Decision modal state: which request is being decided + for which action.
  const [deciding, setDeciding] = useState(null);
  const [replyNote, setReplyNote] = useState("");

  function load() {
    setLoading(true);
    const task = isHR
      ? api(`/time-off/requests${statusFilter ? `?status=${statusFilter}` : ""}`).then((r) => {
          setRequests(r);
          setAllocations([]);
        })
      : api(`/employees/${user.employeeId}/time-off`).then((r) => {
          setRequests(r.requests);
          setAllocations(r.allocations);
        });
    task.catch((e) => alert(e.message)).finally(() => setLoading(false));
  }

  useEffect(load, [statusFilter, isHR, user?.employeeId]);

  // HR decision flows through a modal (replaces the old window.prompt) so a reply
  // note is captured for approve as well as refuse, and shown back to the employee.
  function openDecide(request, action) {
    setDeciding({ request, action });
    setReplyNote(request.responseNote || "");
  }

  async function submitDecision() {
    const { request, action } = deciding;
    setBusyId(request.id);
    try {
      await api(`/time-off/requests/${request.id}/${action}`, {
        method: "POST",
        body: { responseNote: replyNote.trim() || null },
      });
      setDeciding(null);
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  async function withdraw(id) {
    setBusyId(id);
    try {
      await api(`/time-off/requests/${id}`, { method: "DELETE" });
      load();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1>{isHR ? "Time Off Requests" : "My Time Off"}</h1>
        {isHR ? (
          <select className="toolbar-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All status</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REFUSED">Refused</option>
          </select>
        ) : (
          <button className="btn" onClick={() => setShowForm(true)}>NEW REQUEST</button>
        )}
      </div>
      <p className="page-sub">
        {isHR
          ? "Employees spend their allocated balance here — review and approve or refuse their day-off requests."
          : "Pick the days you want off. HR approves, then the days are deducted from your balance."}
      </p>

      {!isHR && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <h3>My Balances</h3>
          {allocations.length === 0 ? (
            <p className="muted">You have no leave allocations yet — ask HR to allocate some.</p>
          ) : (
            <div className="balance-strip">
              {allocations.map((a) => (
                <div className="balance-chip" key={a.id}>
                  <strong>{a.timeOffType?.name}</strong>
                  <span>{Number(a.remaining)} / {Number(a.quota)} {a.timeOffType?.unit === "HOURS" ? "hrs" : "days"}</span>
                  {!a.approvedByHR && <span className="status-pill amber">Pending</span>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              {isHR && <th>Employee</th>}
              <th>Type</th>
              <th>Dates</th>
              <th>Reason</th>
              <th>Status</th>
              <th>HR Reply</th>
              {isHR && <th></th>}
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id}>
                {isHR && <td>{r.employee?.name}</td>}
                <td>{r.timeOffType?.name}</td>
                <td>{fmtDate(r.startDate)} → {fmtDate(r.endDate)}</td>
                <td className="muted">{r.reason || "—"}</td>
                <td>
                  <span className={"badge " + (r.status === "APPROVED" ? "badge-active" : r.status === "REFUSED" ? "badge-inactive" : "")}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
                <td className="muted reply-cell">
                  {r.responseNote ? (
                    <>
                      <div>“{r.responseNote}”</div>
                      <div className="small">
                        {r.approvedBy?.email || r.approvedBy?.id?.slice(0, 8)} • {r.decidedAt ? new Date(r.decidedAt).toLocaleDateString() : ""}
                      </div>
                    </>
                  ) : r.status === "PENDING" ? (
                    "—"
                  ) : (
                    <span className="muted small">No reply note</span>
                  )}
                </td>
                <td>
                  {isHR && r.status === "PENDING" && (
                    <span className="row-actions">
                      <button className="btn btn-secondary btn-sm approve-btn" disabled={busyId === r.id} onClick={() => openDecide(r, "approve")}>Approve</button>
                      <button className="btn btn-secondary btn-sm refuse-btn" disabled={busyId === r.id} onClick={() => openDecide(r, "refuse")}>Refuse</button>
                    </span>
                  )}
                  {!isHR && r.status === "PENDING" && (
                    <button className="btn btn-secondary btn-sm" disabled={busyId === r.id} onClick={() => withdraw(r.id)}>Withdraw</button>
                  )}
                </td>
              </tr>
            ))}
            {requests.length === 0 && (
              <tr>
                <td colSpan={isHR ? 7 : 6} className="muted">
                  {isHR ? "No requests" : "You haven't requested any time off yet."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {!isHR && showForm && (
        <RequestForm
          allocations={allocations}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {deciding && (
        <div className="modal-backdrop" onClick={() => setDeciding(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{deciding.action === "approve" ? "Approve Request" : "Refuse Request"}</h3>
              <button className="modal-close" onClick={() => setDeciding(null)}>×</button>
            </div>
            <p className="page-sub">
              {deciding.request.employee?.name} · {deciding.request.timeOffType?.name} · {fmtDate(deciding.request.startDate)} → {fmtDate(deciding.request.endDate)}
            </p>
            {deciding.request.reason && (
              <p className="card request-reason">“{deciding.request.reason}”</p>
            )}
            <label>
              Reply to employee <span className="muted">(optional)</span>
              <textarea
                rows={3}
                value={replyNote}
                onChange={(e) => setReplyNote(e.target.value)}
                placeholder={deciding.action === "approve" ? "e.g. Approved — enjoy your leave." : "e.g. Not enough coverage that week — please pick different days."}
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setDeciding(null)}>Cancel</button>
              <button className={"btn " + (deciding.action === "approve" ? "approve-btn" : "refuse-btn")} disabled={busyId === deciding.request.id} onClick={submitDecision}>
                {busyId === deciding.request.id ? "Saving…" : deciding.action === "approve" ? "Approve" : "Refuse"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}