import { useState } from "react";
import { api } from "../lib/api";
import { DAYS } from "../pages/Schedules";

// Helper shared by builder UI and backend-equivalent calc (mirrors server.computeWeeklyHours).
function computeHours(shifts) {
  return shifts.reduce((total, s) => {
    if (!s.startTime || !s.endTime) return total;
    const [sh, sm] = s.startTime.split(":").map(Number);
    const [eh, em] = s.endTime.split(":").map(Number);
    let mins = eh * 60 + em - (sh * 60 + sm) - Number(s.breakMinutes || 0);
    if (mins < 0) mins = 0;
    return total + mins / 60;
  }, 0);
}

export default function ScheduleForm({ schedule, onClose, onSaved }) {
  const isEdit = !!schedule;
  const [name, setName] = useState(schedule?.name || "");
  // One row per weekday; empty rows are omitted when saving.
  const [shifts, setShifts] = useState(() =>
    DAYS.map((_, i) => {
      const existing = schedule?.shifts?.find((sh) => sh.dayOfWeek === i);
      return {
        dayOfWeek: i,
        enabled: !!existing,
        startTime: existing?.startTime || "09:00",
        endTime: existing?.endTime || "18:00",
        breakMinutes: existing?.breakMinutes ?? 60,
      };
    })
  );
  const [busy, setBusy] = useState(false);

  function toggleDay(idx) {
    setShifts((arr) => arr.map((s, i) => (i === idx ? { ...s, enabled: !s.enabled } : s)));
  }

  function updateShift(idx, k, v) {
    setShifts((arr) => arr.map((s, i) => (i === idx ? { ...s, [k]: v } : s)));
  }

  const activeShifts = shifts.filter((s) => s.enabled);
  const total = computeHours(activeShifts);

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    try {
      const payload = {
        name,
        shifts: activeShifts.map((s) => ({
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          breakMinutes: Number(s.breakMinutes) || 0,
        })),
      };
      if (isEdit) await api(`/schedules/${schedule.id}`, { method: "PATCH", body: payload });
      else await api("/schedules", { method: "POST", body: payload });
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
          <h3>{isEdit ? "Edit Schedule" : "New Schedule"}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label>
            Schedule Name
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Standard 9–6" required />
          </label>

          <div className="shift-table">
            <div className="shift-head">
              <span>Day</span>
              <span>Start</span>
              <span>End</span>
              <span>Break (min)</span>
            </div>
            {shifts.map((s, idx) => (
              <div className={"shift-row" + (s.enabled ? "" : " shift-off")} key={idx}>
                <label className="shift-day">
                  <input type="checkbox" checked={s.enabled} onChange={() => toggleDay(idx)} />
                  {DAYS[idx]}
                </label>
                <input type="time" value={s.startTime} disabled={!s.enabled} onChange={(e) => updateShift(idx, "startTime", e.target.value)} />
                <input type="time" value={s.endTime} disabled={!s.enabled} onChange={(e) => updateShift(idx, "endTime", e.target.value)} />
                <input type="number" min="0" value={s.breakMinutes} disabled={!s.enabled} onChange={(e) => updateShift(idx, "breakMinutes", e.target.value)} />
              </div>
            ))}
          </div>

          <div className="weekly-total">
            Total weekly hours: <strong>{total.toFixed(1)} hrs / week</strong>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn" disabled={busy || activeShifts.length === 0}>
              {busy ? "Saving…" : isEdit ? "Save changes" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}