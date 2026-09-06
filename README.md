# PeoplePay360 🧾⚡

**Unified HR & Payroll Operations Platform**

> One source of truth (the Employee) → connected to Contracts, Schedules, Attendance & Leave → feeding a rule-based Payroll Engine → producing validated payslips & a live dashboard.

---

## 🎯 The Problem

Most HR tools treat employees, attendance, leave, contracts, and payroll as **disconnected silos**:

| Silo Problem | Real-World Consequence |
|---|---|
| Overlapping/stale contracts | Wrong wage picked up during payroll |
| Attendance ≠ Leave records | Worked hours & balances don't match reality |
| Rigid payroll scripts | Can't add a new allowance/deduction without code changes |

**PeoplePay360 fixes this** by making the **Employee Master Record** the hub everything else plugs into.

---

## 🧩 What It Does (Feature Summary)

### 🟦 80% — Daily HR Core
Employee profiles ⇄ Contracts ⇄ Schedules ⇄ Attendance ⇄ Time-Off, with **leave approval auto-deducting balances** in real time.

### 🟩 20% — The Differentiator
A **sequenced Salary Rules Engine** (`Basic → Allowance → Gross → Deduction → Net`) driving a 2-step Payrun Wizard that computes, validates, locks, and PDFs payslips — plus a **live dashboard** with zero hardcoded numbers.

---

## 🔁 How Everything Connects (System Flow)

```
                         ┌────────────────────┐
                         │   EMPLOYEE MASTER  │  ← single source of truth
                         └──────────┬─────────┘
           ┌───────────┬────────────┼────────────┬───────────────┐
           ▼           ▼            ▼            ▼               ▼
      [Contract]  [Schedule]  [Attendance]  [Time-Off Alloc] [Time-Off Req]
        1 active     1:1        check-in/     quota per          → Approve →
        per period   pattern    out → hrs      leave type        decrements
           │                                                     allocation
           ▼
     [Salary Structure] ──▶ [Salary Rules, ordered by Sequence]
           │
           ▼
     ┌─────────────────────────── PAYRUN BATCH ───────────────────────────┐
     │  Draft → Compute → (resolve active contract per employee)          │
     │        → run rules in sequence → Computed                          │
     │        → flag warnings (missing bank, dup payslip, unapproved lv)  │
     │        → Validate → Mark Paid (🔒 locked) → Send (PDF + email)     │
     └──────────────────────────┬─────────────────────────────────────────┘
                                 ▼
                            [Payslip + Lines]
                                 │
                                 ▼
                       📊 LIVE DASHBOARD (KPIs, trends, alerts)
```

**End-to-end demo path:**
```
Create Employee → Assign Schedule + Contract
   -> Log Attendance / Request & Approve Leave (balance auto-deducts)
   -> Launch Payrun Wizard (period + structure + employees)
   -> Compute -> Review rule-by-rule breakdown -> Resolve warnings
   -> Validate -> Mark Paid -> Download PDF / Send
   -> Dashboard updates instantly
```

---

## 🛠️ Tech Stack

| Layer | Choice | Why |
|---|---|---|
| **Frontend** | Next.js / React + TypeScript + Tailwind CSS + Lucide Icons | Fast to build, typed, responsive out of the box |
| **Backend** | Node.js (Express) | Simple REST layer, same language as frontend |
| **Database** | SQLite
| **ORM** | Prisma ORM
| **Auth** | JWT/session-based, 5-role RBAC
| **PDF** | Headless PDF generator (e.g. Puppeteer / `pdf-lib`) | Printable itemized payslips |

> Recommended add-ons if time allows: **Redis/BullMQ** (background payrun jobs), **shadcn/ui** (fast polished components), **Recharts** (dashboard charts).

---

## 👥 Roles & Access (RBAC)

| Role | Can Do |
|---|---|
| **Employee (EMP)** | View own profile/schedule/attendance/balance, check-in/out, request leave |
| **HR Manager (HRM)** | Full CRUD: Employees, Contracts, Schedules, Attendance, Time-Off + Approve/Refuse. ❌ No payroll access |
| **HR Payroll User (HPU)** | Inherits HRM + Create/Read/Update Payruns & Payslips. Read-only Salary Rules |
| **HR Payroll Manager (HPM)** | Full CRUD over Payruns, Payslips, Salary Structures & Rules |
| **Admin (ADM)** | Unrestricted — including user/role provisioning |

🔒 Every rule above is enforced at the **API layer**, not just hidden in the UI — see `API.md`'s RBAC matrix.

---

## 🗂️ Data Model (Quick View)

```
Employee ─1:N─ Contract ─N:1─ SalaryStructure ─1:N─ SalaryRule
   │─1:1─ WorkingSchedule
   │─1:N─ Attendance
   │─1:N─ TimeOffAllocation ─N:1─ TimeOffType
   └─1:N─ TimeOffRequest ──▶ (on approve) decrements Allocation

PayrunBatch ─1:N─ Payslip ─1:N─ PayslipLine ─N:1─ SalaryRule
```

Full schema (Prisma models, constraints, enums) → **[`DATABASE.md`](./DATABASE.md)**
Full endpoint reference (roles, request/response shapes) → **[`API.md`](./API.md)**

---

## 🚀 Getting Started

```bash
# 1. Clone & install
git clone <repo-url> peoplepay360
cd peoplepay360
npm install

# 2. Configure environment
cp .env.example .env
# → set DATABASE_URL, JWT_SECRET

# 3. Set up the database
npx prisma migrate dev
npx prisma db seed        # loads demo employees, contracts, schedules, leave types

# 4. Run it
npm run dev                # frontend + API
```

**Requirements:** Node.js v18+, SQLite

---

## ✅ Definition of Done (Success Criteria)

- [ ] Full payrun run: create batch → compute → inspect breakdown → resolve warnings → validate → mark paid → export, with **zero manual DB edits**
- [ ] Payroll always picks the **period-active contract** (overlaps blocked)
- [ ] Approving leave **instantly deducts** the balance
- [ ] Dashboard is **100% live-queried**, no static numbers
- [ ] RBAC visibly restricts actions across ≥3 roles in the live demo

---

## 📌 Priority Matrix

| Priority | Includes |
|---|---|
| **P0 — Must Demo** | Employee Master, period-active Contract logic, Time-Off request→approve→deduct, Salary Rules (Fixed/%), 2-Step Payrun Wizard + Compute, Payslip breakdown, RBAC login |
| **P1 — Should Have** | Attendance check-in/out, auto weekly-hours calc, Payslip PDF export, validation warnings, live Dashboard (KPIs + charts) |
| **P2 — Stretch** | Bulk email dispatch, formula-based rules, Employee Kanban, full 5-role test coverage |

---

## 🎬 Live Demo Script (5 min)

1. **Employee → Paid Payslip** (3 min): Open employee → jump to Contract/Schedule via smart nav → run Payrun Wizard → Compute → review rule breakdown → Validate → Mark Paid → download PDF.
2. **Leave Lifecycle** (1.5 min): Check balance → submit request as Employee → switch to HR Manager → Approve → balance updates live.
3. **Dashboard** (0.5 min): Show KPIs/department chart/attendance status update instantly after the above actions.

---

## ⚠️ Known Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Overlapping contracts break payroll | DB + service-layer overlap validation on save |
| Rule dependency cycles | Strictly ascending `sequence`, enforced on write |
| PDF/email delays demo | Headless/browser-print PDF; email dispatch simulated |
| Dashboard shows stale/mock data | Aggregate queries hit live tables from hour 1 |

---

## 🚧 Out of Scope (Post-Hackathon)

Country-specific tax packs · Multi-company/currency · Real banking rails (simulated via *Mark Paid*) · Biometric hardware (simulated via web check-in) · Email Integration

<div align="center">
  <sub>Thank you Odoo this Creative Hackathon ❤️</sub>
</div>