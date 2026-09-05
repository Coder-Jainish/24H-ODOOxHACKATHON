const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding PeoplePay360 database...");

  const password = await bcrypt.hash("password123", 10);

  // Salary structure needed before contracts can reference it
  const salaryStructure = await prisma.salaryStructure.upsert({
    where: { name: "Regular Full-Time" },
    update: {},
    create: {
      name: "Regular Full-Time",
    },
  });

  // 5 role accounts — each linked to an Employee
  const roles = [
    {
      email: "employee@pp360.com",
      role: "EMPLOYEE",
      name: "Demo Employee",
      department: "Engineering",
      jobPosition: "Software Engineer",
    },
    {
      email: "hrm@pp360.com",
      role: "HR_MANAGER",
      name: "Demo HR Manager",
      department: "Human Resources",
      jobPosition: "HR Manager",
    },
    {
      email: "hpu@pp360.com",
      role: "HR_PAYROLL_USER",
      name: "Demo Payroll User",
      department: "Payroll",
      jobPosition: "Payroll Specialist",
    },
    {
      email: "hpm@pp360.com",
      role: "HR_PAYROLL_MANAGER",
      name: "Demo Payroll Manager",
      department: "Payroll",
      jobPosition: "Payroll Manager",
    },
    {
      email: "admin@pp360.com",
      role: "ADMIN",
      name: "Demo Admin",
      department: "Administration",
      jobPosition: "System Administrator",
    },
  ];

  for (const r of roles) {
    const employee = await prisma.employee.upsert({
      where: { email: r.email },
      update: {},
      create: {
        name: r.name,
        email: r.email,
        department: r.department,
        jobPosition: r.jobPosition,
      },
    });

    await prisma.user.upsert({
      where: { email: r.email },
      update: { role: r.role },
      create: {
        email: r.email,
        passwordHash: password,
        role: r.role,
        employeeId: employee.id,
      },
    });
  }

  // Basic salary structure rules (Basic, HRA, PF, Net) — idempotent upserts
  const salaryRules = [
    {
      name: "Basic Salary",
      code: "BASIC",
      category: "BASIC",
      sequence: 1,
      calculationType: "FIXED",
      value: 50000,
    },
    {
      name: "House Rent Allowance",
      code: "HRA",
      category: "ALLOWANCE",
      sequence: 2,
      calculationType: "PERCENTAGE",
      value: 20,
      baseRuleCode: "BASIC",
    },
    {
      name: "Provident Fund",
      code: "PF",
      category: "DEDUCTION",
      sequence: 3,
      calculationType: "PERCENTAGE",
      value: 12,
      baseRuleCode: "BASIC",
    },
    {
      name: "Net Salary",
      code: "NET",
      category: "NET",
      sequence: 4,
      calculationType: "FORMULA",
      formula: "BASIC + HRA - PF",
    },
  ];
  for (const r of salaryRules) {
    const exists = await prisma.salaryRule.findFirst({
      where: { salaryStructureId: salaryStructure.id, code: r.code },
    });
    if (!exists) {
      await prisma.salaryRule.create({ data: { salaryStructureId: salaryStructure.id, ...r } });
    }
  }

  console.log("✅ Seeded 5 role accounts:");
  console.log("   employee@pp360.com  (EMPLOYEE)        → password: password123");
  console.log("   hrm@pp360.com       (HR_MANAGER)       → password: password123");
  console.log("   hpu@pp360.com       (HR_PAYROLL_USER)  → password: password123");
  console.log("   hpm@pp360.com       (HR_PAYROLL_MANAGER) → password: password123");
  console.log("   admin@pp360.com     (ADMIN)            → password: password123");
  console.log("✅ Seeded salary structure + 4 rules (BASIC, HRA, PF, NET)");

  // Sample employees (match the design's Kanban/List cards: Aarav, Sara, John, Neha)
  const sampleEmployees = [
    { name: "Aarav Mehta", email: "aarav@oxp.com", department: "Finance", jobPosition: "Payroll Specialist" },
    { name: "Sara Khan", email: "sara@oxp.com", department: "HR", jobPosition: "HR Officer" },
    { name: "John Dsouza", email: "john@oxp.com", department: "Engineering", jobPosition: "Developer" },
    { name: "Neha Patel", email: "neha@oxp.com", department: "HR", jobPosition: "Recruiter" },
  ];

  for (const s of sampleEmployees) {
    await prisma.employee.upsert({
      where: { email: s.email },
      update: {},
      create: s,
    });
  }

  // Set manager hierarchy: Aarav reports to Sara
  const sara = await prisma.employee.findUnique({ where: { email: "sara@oxp.com" } });
  if (sara) {
    await prisma.employee.update({
      where: { email: "aarav@oxp.com" },
      data: { managerId: sara.id },
    });
  }

  console.log("✅ Seeded 4 sample employees (Aarav, Sara, John, Neha)");

  // Sample contracts — gives the Contracts list/employee page something to show.
  // Aarav: one expired (2025) + one Running (2026, open-ended) — the active-contract badge.
  const aarav = await prisma.employee.findUnique({ where: { email: "aarav@oxp.com" } });

  if (aarav && sara) {
    const existing = await prisma.contract.findFirst({ where: { employeeId: aarav.id } });
    if (!existing) {
      await prisma.contract.create({
        data: {
          employeeId: aarav.id,
          startDate: new Date("2025-07-01"),
          endDate: new Date("2025-12-31"),
          wage: 78000,
          department: "Finance",
          position: "Payroll Specialist",
          salaryStructureId: salaryStructure.id,
          status: "EXPIRED",
        },
      });
      await prisma.contract.create({
        data: {
          employeeId: aarav.id,
          startDate: new Date("2026-01-01"),
          endDate: null,
          wage: 85000,
          department: "Finance",
          position: "Payroll Specialist",
          salaryStructureId: salaryStructure.id,
          status: "ACTIVE",
        },
      });
      await prisma.contract.create({
        data: {
          employeeId: sara.id,
          startDate: new Date("2026-01-01"),
          endDate: null,
          wage: 95000,
          department: "HR",
          position: "HR Officer",
          salaryStructureId: salaryStructure.id,
          status: "ACTIVE",
        },
      });
      console.log("✅ Seeded 3 sample contracts (Aarav: 1 expired + 1 running, Sara: running)");
    }
  }

  // Sample contracts (continued) — active contracts for John + the demo employee,
  // so the Payrun wizard (Step 9) has more than 2 employees with an active wage.
  const john = await prisma.employee.findUnique({ where: { email: "john@oxp.com" } });
  const demoEmp = await prisma.employee.findUnique({ where: { email: "employee@pp360.com" } });
  const extraContracts = [
    { employee: john, wage: 70000, department: "Engineering", position: "Developer" },
    { employee: demoEmp, wage: 65000, department: "Engineering", position: "Software Engineer" },
  ];
  for (const c of extraContracts) {
    if (!c.employee) continue;
    const exists = await prisma.contract.findFirst({ where: { employeeId: c.employee.id, status: "ACTIVE" } });
    if (!exists) {
      await prisma.contract.create({
        data: {
          employeeId: c.employee.id,
          startDate: new Date("2026-01-01"),
          endDate: null,
          wage: c.wage,
          department: c.department,
          position: c.position,
          salaryStructureId: salaryStructure.id,
          status: "ACTIVE",
        },
      });
    }
  }
  console.log("✅ Seeded active contracts for John and the demo employee");

  // Sample working schedule — Standard 9–6, Mon–Fri (40 hrs/wk), assigned to sample employees
  const existingSchedule = await prisma.workingSchedule.findFirst({ where: { name: "Standard 9-6" } });
  let standardSchedule = existingSchedule;
  if (!existingSchedule) {
    standardSchedule = await prisma.workingSchedule.create({
      data: {
        name: "Standard 9-6",
        totalWeeklyHours: 40,
        shifts: {
          create: [1, 2, 3, 4, 5].map((d) => ({
            dayOfWeek: d,
            startTime: "09:00",
            endTime: "18:00",
            breakMinutes: 60,
          })),
        },
      },
    });
  }

  if (standardSchedule) {
    const scheduleEmployees = await prisma.employee.findMany({
      where: { workingScheduleId: null, OR: [{ email: { in: ["aarav@oxp.com", "sara@oxp.com", "john@oxp.com"] } }] },
    });
    for (const se of scheduleEmployees) {
      await prisma.employee.update({ where: { id: se.id }, data: { workingScheduleId: standardSchedule.id } });
    }
  }
  console.log("✅ Seeded Standard 9-6 schedule (40 hrs/wk) assigned to sample employees");

  // Time Off Types — policy config (Annual, Sick, Comp Off)
  const timeOffTypes = [
    { name: "Paid Time Off", unit: "DAYS", requiresApproval: true, tracksBalance: true },
    { name: "Sick Leave", unit: "DAYS", requiresApproval: true, tracksBalance: true },
    { name: "Comp Off", unit: "HOURS", requiresApproval: true, tracksBalance: true },
  ];
  for (const t of timeOffTypes) {
    const exists = await prisma.timeOffType.findFirst({ where: { name: t.name } });
    if (!exists) await prisma.timeOffType.create({ data: t });
  }
  console.log("✅ Seeded 3 time off types (Paid Time Off, Sick Leave, Comp Off)");

  // Time Off Allocations — annual balances for sample employees, pre-approved (spendable)
  const pto = await prisma.timeOffType.findFirst({ where: { name: "Paid Time Off" } });
  const sick = await prisma.timeOffType.findFirst({ where: { name: "Sick Leave" } });
  if (pto && sick) {
    const targets = [
      { email: "aarav@oxp.com", typeId: pto.id, quota: 24, unit: "DAYS" },
      { email: "sara@oxp.com", typeId: pto.id, quota: 20 },
      { email: "sara@oxp.com", typeId: sick.id, quota: 8 },
      { email: "john@oxp.com", typeId: pto.id, quota: 22 },
      { email: "employee@pp360.com", typeId: pto.id, quota: 20 },
    ];
    for (const t of targets) {
      const emp = await prisma.employee.findFirst({ where: { email: t.email } });
      if (!emp) continue;
      const exists = await prisma.timeOffAllocation.findFirst({
        where: { employeeId: emp.id, timeOffTypeId: t.typeId, validFrom: new Date("2026-01-01") },
      });
      if (!exists) {
        await prisma.timeOffAllocation.create({
          data: {
            employeeId: emp.id,
            timeOffTypeId: t.typeId,
            quota: t.quota,
            remaining: t.quota,
            validFrom: new Date("2026-01-01"),
            validTo: null,
            approvedByHR: true,
          },
        });
      }
    }
  }
  console.log("✅ Seeded time off allocations (Aarav 24 PTO, Sara 20 PTO + 8 Sick, John 22 PTO, EMP demo 20 PTO)");

  // Pre-computed payrun (June 2026) so the Payruns list/dashboard have history.
  // Bootstrap data only — computed here once; live batches go through the runtime
  // POST /api/payruns/:id/compute route (which reuses computePayslip() from server.js).
  const juneBatch = await prisma.payrunBatch.findFirst({ where: { periodStart: new Date("2026-06-01") } });
  if (!juneBatch) {
    const rules = await prisma.salaryRule.findMany({
      where: { salaryStructureId: salaryStructure.id },
      orderBy: { sequence: "asc" },
    });
    const activeContracts = await prisma.contract.findMany({ where: { status: "ACTIVE" } });
    const batch = await prisma.payrunBatch.create({
      data: {
        periodStart: new Date("2026-06-01"),
        periodEnd: new Date("2026-06-30"),
        salaryStructureId: salaryStructure.id,
        state: "COMPUTED",
        computedAt: new Date(),
      },
    });
    for (const contract of activeContracts) {
      // Mirror the rule engine for bootstrap data (seed-time only).
      const amounts = {};
      const lines = [];
      for (const rule of rules) {
        let amount = 0;
        if (rule.calculationType === "FIXED") {
          amount = rule.value != null ? Number(rule.value) : Number(contract.wage) || 0;
        } else if (rule.calculationType === "PERCENTAGE") {
          amount = (amounts[rule.baseRuleCode] ?? 0) * (Number(rule.value) || 0) / 100;
        } else if (rule.calculationType === "FORMULA") {
          // Simple additive evaluator for bootstrap data — supports "A + B - C".
          const tokens = (rule.formula || "").replace(/\s+/g, "").match(/[A-Za-z_][A-Za-z_0-9]*|[+\-]/g) || [];
          let total = 0;
          let sign = 1;
          for (const t of tokens) {
            if (t === "+") sign = 1;
            else if (t === "-") sign = -1;
            else total += sign * (amounts[t] ?? 0);
          }
          amount = total;
        }
        amounts[rule.code] = amount;
        lines.push({ salaryRuleId: rule.id, sequence: rule.sequence, category: rule.category, amount });
      }
      const gross = lines.filter((l) => l.category === "BASIC" || l.category === "ALLOWANCE").reduce((s, l) => s + l.amount, 0);
      const deductions = lines.filter((l) => l.category === "DEDUCTION").reduce((s, l) => s + l.amount, 0);
      const net = Number(amounts.NET ?? (gross - deductions));
      const payslip = await prisma.payslip.create({
        data: {
          payrunBatchId: batch.id,
          employeeId: contract.employeeId,
          contractId: contract.id,
          grossTotal: gross,
          deductionTotal: deductions,
          netTotal: net,
        },
      });
      await prisma.payslipLine.createMany({
        data: lines.map((l) => ({ ...l, payslipId: payslip.id })),
      });
    }
    console.log("✅ Seeded pre-computed June 2026 payrun batch");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });