import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import EmployeeForm from "../components/EmployeeForm";

function initials(name = "") {
  return name
    .split(" ")
    .map((w) => (w[0] || "").toUpperCase())
    .slice(0, 2)
    .join("");
}

export default function Employees() {
  const navigate = useNavigate();
  const [view, setView] = useState("kanban"); // kanban | list
  const [employees, setEmployees] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  function load() {
    setLoading(true);
    api("/employees")
      .then(setEmployees)
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const filtered = employees.filter((e) =>
    (e.name + e.department + e.jobPosition).toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <h1>Employees</h1>
        <button className="btn" onClick={() => setShowForm(true)}>
          NEW
        </button>
      </div>
      <div className="toolbar">
        <input
          className="search"
          placeholder="Search employees…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="view-toggle">
          <button className={view === "kanban" ? "active" : ""} onClick={() => setView("kanban")}>
            Kanban
          </button>
          <button className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
            List
          </button>
        </div>
      </div>

      {loading ? (
        <p className="muted">Loading…</p>
      ) : view === "kanban" ? (
        <div className="employee-grid">
          {filtered.map((e) => (
            <div key={e.id} className="employee-card" onClick={() => navigate(`/employees/${e.id}`)}>
              <div className="avatar">{initials(e.name)}</div>
              <div className="emp-name">{e.name}</div>
              <div className="emp-position">{e.jobPosition}</div>
              <div className="emp-dept">{e.department}</div>
              <span className={"badge " + (e.isActive ? "badge-active" : "badge-inactive")}>
                {e.isActive ? "Active" : "Inactive"}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Work Email</th>
              <th>Job Position</th>
              <th>Department</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.id} onClick={() => navigate(`/employees/${e.id}`)} style={{ cursor: "pointer" }}>
                <td>{e.name}</td>
                <td>{e.email}</td>
                <td>{e.jobPosition}</td>
                <td>{e.department}</td>
                <td>
                  <span className={"badge " + (e.isActive ? "badge-active" : "badge-inactive")}>
                    {e.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {showForm && (
        <EmployeeForm
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