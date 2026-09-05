# PeoplePay360 — Integrated HR & Payroll Platform

## 1. Project Name
**PeoplePay360** — Unified HR & Payroll Operations System

---

## 2. Objective
Eliminate disconnected HR silos by establishing the **Employee Master Record** as the central operational hub, connecting contracts, schedules, attendance, and leave directly into an automated, rule-based payrun and payslip computation engine.

---

## 3. Main Features

### Feature 1: Unified HR & Time Operations (80% Daily Core)
Centralized employee lifecycle management connecting historical contracts and weekly working schedules with daily attendance tracking (check-in/out) and a time-off approval workflow that automatically deducts from employee allocation balances.

### Feature 2: Rule-Based Payrun & Payslip Engine (20% MVP Differentiator)
A 2-step payrun wizard that automatically identifies period-active contracts, executes sequenced salary calculation rules (Basic $\rightarrow$ Allowances $\rightarrow$ Deductions $\rightarrow$ Net), highlights pre-validation warnings, generates itemized PDF payslips, and feeds real-time metrics to an executive dashboard.

---

## 4. Tech Stack

- **Frontend:** Next.js / React, TypeScript, Tailwind CSS, Lucide Icons
- **Backend:** Node.js (Express)
- **Database & ORM:** SQLite with Prisma ORM
- **Document Engine:** Headless PDF generator for printable payslips
- **Authentication:** Role-Based Access Control (RBAC) with 5 distinct roles

---

## 5. Target Users

| Role | Primary Purpose |
| :--- | :--- |
| **Employee** | View profile, clock attendance, check leave balances, and submit time-off requests |
| **HR Manager** | Manage employee profiles, contracts, schedules, and approve/refuse leave |
| **HR Payroll User** | Execute payruns, review payslips, and inspect calculation breakdowns |
| **HR Payroll Manager** | Full authority over payruns, payslips, salary structures, and sequenced rules |
| **Admin** | System configuration, user provisioning, and role permission management |

---

## 6. Setup Requirements

### Current Setup (Hackathon MVP)
1. **Runtime:** Node.js (v18+)
2. **Database:** SQLite
3. **Configuration:** `.env` file for database connection and auth secret keys
4. **Data Seeding:** Run seed script to populate demo employees, contracts, schedules, and leave types

### Future Setup (Production)
- SMTP service for automated payslip email delivery
- Redis / BullMQ for background payroll processing queues
- S3-compatible cloud storage for archived PDF payslips

---

## 7. Priority Matrix

- **P0 (Must Have):** Employee Master, Period-Active Contract selection, Leave Request $\rightarrow$ Approval $\rightarrow$ Deduction, Sequenced Salary Rules, 2-Step Payrun Wizard, Payslip Breakdown, Role Login.
- **P1 (Should Have):** Attendance check-in/out, Automatic weekly hours calculation, PDF payslip export, Validation warnings, Live Dashboard KPIs & charts.
- **P2 (Nice to Have):** Bulk payslip email delivery, complex formula builder, employee Kanban view.

---

## 8. Development Tasks
Detailed step-by-step task breakdown and execution checklist can be found in **[TASKS.md](./TASKS.md)**.
