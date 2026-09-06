import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../lib/auth-context";

// Dashboard analytics are payroll roles + Admin (API.md §12); HR Manager has no
// Payroll access (PRD §3).
const ANALYTICS_ROLES = ["HR_PAYROLL_USER", "HR_PAYROLL_MANAGER", "ADMIN"];

export default function Dashboard() {
  const { user } = useAuth();
  const canAnalyze = ANALYTICS_ROLES.includes(user?.role);

  const [meta, setMeta] = useState({ departments: [], employmentTypes: [] });
  const [filters, setFilters] = useState({
    department: "all",
    employmentType: "all",
    periodStart: "",
    periodEnd: "",
    months: 6,
  });
  const [kpis, setKpis] = useState(null);
  const [trend, setTrend] = useState([]);
  const [deptCost, setDeptCost] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filter options come from live tables (departments + salary structures).
  useEffect(() => {
    if (!canAnalyze) return;
    Promise.all([api("/employees"), api("/salary-structures")])
      .then(([employees, structures]) => {
        setMeta({
          departments: [...new Set((employees || []).map((e) => e.department).filter(Boolean))].sort(),
          employmentTypes: [...new Set((structures || []).map((s) => s.name))].filter(Boolean),
        });
      })
      .catch(() => setMeta({ departments: [], employmentTypes: [] }));
  }, [canAnalyze]);

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (filters.department !== "all") p.set("department", filters.department);
    if (filters.employmentType !== "all") p.set("employmentType", filters.employmentType);
    if (filters.periodStart) p.set("periodStart", filters.periodStart);
    if (filters.periodEnd) p.set("periodEnd", filters.periodEnd);
    p.set("months", filters.months);
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [filters]);

  useEffect(() => {
    if (!canAnalyze) return;
    setLoading(true);
    Promise.all([
      api(`/dashboard/kpis${query}`),
      api(`/dashboard/trends/net-salary${query}`),
      api(`/dashboard/department-cost${query}`),
      api("/dashboard/alerts"),
    ])
      .then(([k, t, d, a]) => {
        setKpis(k);
        setTrend(t || []);
        setDeptCost(d || []);
        setAlerts(a || []);
      })
      .catch((e) => alert(e.message))
      .finally(() => setLoading(false));
  }, [canAnalyze, query]);

  if (!canAnalyze) {
    return (
      <div>
        <div className="page-header">
          <h1>Welcome, {user?.name || user?.role}</h1>
        </div>
        <div className="card">
          <p>
            The payroll dashboard (KPIs, net-salary trend, department cost and operational alerts)
            is available to <strong>HR Payroll User, HR Payroll Manager</strong> and{" "}
            <strong>Admin</strong> roles.
          </p>
          <p className="muted">Signed in as {user?.email} · {user?.role}.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Payroll Dashboard</h1>
        <span className="muted small">Live figures from current payroll tables</span>
      </div>

      <div className="dash-filters">
        <select className="toolbar-select" value={filters.department} onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}>
          <option value="all">All departments</option>
          {meta.departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select className="toolbar-select" value={filters.employmentType} onChange={(e) => setFilters((f) => ({ ...f, employmentType: e.target.value }))}>
          <option value="all">All employment types</option>
          {meta.employmentTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input type="date" value={filters.periodStart} onChange={(e) => setFilters((f) => ({ ...f, periodStart: e.target.value }))} />
        <span className="muted small">→</span>
        <input type="date" value={filters.periodEnd} onChange={(e) => setFilters((f) => ({ ...f, periodEnd: e.target.value }))} />
        <select className="toolbar-select" value={filters.months} onChange={(e) => setFilters((f) => ({ ...f, months: Number(e.target.value) }))}>
          {[3, 6, 12].map((m) => (
            <option key={m} value={m}>{m} months</option>
          ))}
        </select>
        {loading && <span className="muted small">Refreshing…</span>}
      </div>

      {kpis ? (
        <>
          <div className="dash-kpis">
            <KpiCard label="Total Net Paid" value={money(kpis.totalNetPaid)} sub="PAID / CLOSED payruns" primary />
            <KpiCard label="Payslips Generated" value={String(kpis.payslipsGenerated)} sub="in filtered period" />
            <KpiCard label="Average Salary" value={money(kpis.averageSalary)} sub="per payslip" />
            <KpiCard label="Approved Time Off" value={`${kpis.approvedTimeOffDays} d`} sub="approved days" />
            <KpiCard label="Attendance Health" value={`${kpis.attendanceHealthPct}%`} sub="non-absent records" />
          </div>

          <div className="dash-grid">
            <div className="card dash-chart-card">
              <h3 className="section-title">Net Salary Trend</h3>
              <TrendChart data={trend} />
            </div>
            <div className="card dash-chart-card">
              <h3 className="section-title">Department Cost</h3>
              <DeptBars data={deptCost} />
            </div>
          </div>

          <div className="card" style={{ marginTop: "1rem" }}>
            <h3 className="section-title" style={{ marginBottom: "0.75rem" }}>Operational Alerts</h3>
            <AlertList alerts={alerts} />
          </div>
        </>
      ) : (
        <p className="muted">Loading dashboard…</p>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, primary }) {
  return (
    <div className={"kpi-card" + (primary ? " kpi-primary" : "")}>
      <span className="kpi-label">{label}</span>
      <span className="kpi-value">{value}</span>
      <span className="kpi-sub">{sub}</span>
    </div>
  );
}

// Dependency-free SVG line/area chart for the net-salary trend.
function TrendChart({ data }) {
  const W = 780, H = 250, PL = 52, PR = 18, PT = 18, PB = 34;
  const iw = W - PL - PR, ih = H - PT - PB;
  const steps = data.length;
  const max = Math.max(...data.map((d) => d.totalNet), 1);
  const x = (i) => PL + (steps === 1 ? iw / 2 : (i / (steps - 1)) * iw);
  const y = (v) => PT + ih - (v / max) * ih;
  const pts = data.map((d, i) => `${x(i).toFixed(1)},${y(d.totalNet).toFixed(1)}`).join(" ");
  const area = `${PL},${PT + ih} ${pts} ${x(steps - 1).toFixed(1)},${PT + ih}`;
  const grid = [0, 1, 2, 3].map((k) => k * max / 3);

  if (steps === 0) return <p className="muted">No salary data in the selected window.</p>;

  return (
    <svg className="trend-chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {grid.map((v) => (
        <g key={v}>
          <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} stroke="#eef0f4" strokeWidth="1" />
          <text x={PL - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#999">{compactMoney(v)}</text>
        </g>
      ))}
      <polygon points={area} fill="rgba(113, 75, 103, 0.10)" />
      <polyline points={pts} fill="none" stroke="var(--ox)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <g key={d.month}>
          <circle cx={x(i)} cy={y(d.totalNet)} r="4" fill="var(--ox)" stroke="#fff" strokeWidth="1.5">
            <title>{`${monthLabel(d.month)}: ${money(d.totalNet)}`}</title>
          </circle>
          <text x={x(i)} y={H - 10} textAnchor="middle" fontSize="10" fill="#999">{monthLabel(d.month)}</text>
        </g>
      ))}
    </svg>
  );
}

// Horizontal bar list for department spend.
function DeptBars({ data }) {
  const max = Math.max(...data.map((d) => d.totalSpend), 1);
  if (data.length === 0) return <p className="muted">No payrun data for the selected period.</p>;
  return (
    <div className="dept-bars">
      {data.map((d) => (
        <div key={d.department} className="bar-row" title={`${d.department} · ${d.headcount} employee(s) · ${money(d.totalSpend)}`}>
          <span className="bar-label">{d.department}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(d.totalSpend / max) * 100}%` }} />
          </div>
          <span className="bar-val">₹{(d.totalSpend / 1000).toFixed(1)}k · {d.headcount}</span>
        </div>
      ))}
    </div>
  );
}

function AlertList({ alerts }) {
  if (alerts.length === 0) return <p className="muted">All clear — no operational alerts.</p>;
  return (
    <div className="alert-list">
      {alerts.map((a, i) => (
        <div key={i} className={"alert-item alert-" + a.severity}>
          <span className="alert-type">{a.type}</span>
          <span className="alert-msg">{a.message}</span>
        </div>
      ))}
    </div>
  );
}

function money(n) {
  return "₹" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function compactMoney(v) {
  return v >= 1000 ? `₹${(v / 1000).toFixed(0)}k` : `₹${v}`;
}

function monthLabel(key) {
  const d = new Date(`${key}-01T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short" }) + " '" + String(d.getFullYear()).slice(2);
}