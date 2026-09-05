import { useEffect, useState } from "react";
import { api } from "../lib/api";
import ScheduleForm from "../components/ScheduleForm";

// Day names in display order (0=Sunday … 6=Saturday).
export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function Schedules() {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api("/schedules").then(setSchedules).catch((e) => alert(e.message)).finally(() => setLoading(false));
  }

  useEffect(load, []);

  return (
    <div>
      <div className="page-header">
        <h1>Working Schedules</h1>
        <button className="btn" onClick={() => setShowForm(true)}>
          NEW
        </button>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Schedule</th>
              <th>Weekly Hours</th>
              <th>Days</th>
              <th>Assigned Employees</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td>
                <td>
                  <strong>{s.totalWeeklyHours} hrs / week</strong>
                </td>
                <td>
                  {s.shifts
                    .slice()
                    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
                    .map((sh) => (
                      <span key={sh.id} className="day-chip">
                        {DAYS[sh.dayOfWeek]} {sh.startTime}–{sh.endTime}
                        {sh.breakMinutes ? ` (${sh.breakMinutes}m)` : ""}
                      </span>
                    ))}
                </td>
                <td>{s._count.employees}</td>
                <td>
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowForm(s)}>
                    Edit
                  </button>
                </td>
              </tr>
            ))}
            {schedules.length === 0 && (
              <tr>
                <td colSpan={5} className="muted">No schedules yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {showForm && (
        <ScheduleForm
          schedule={showForm === true ? null : showForm}
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