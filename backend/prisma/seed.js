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
  console.log("\n🌱 Adding extended PeoplePay360 demo data...");

  // ---------------------------------------------------------------
  // 0. Deterministic random helpers
  // ---------------------------------------------------------------
  const DEMO_SEED = 360;
  let rngState = DEMO_SEED;

  const rand = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 4294967296;
  };

  const pick = (arr) => arr[Math.floor(rand() * arr.length)];

  const int = (min, max) =>
    Math.floor(rand() * (max - min + 1)) + min;

  const dateAt = (
    year,
    month,
    day,
    hour = 9,
    minute = 0
  ) => new Date(year, month - 1, day, hour, minute, 0);


  // ---------------------------------------------------------------
  // 1. Employee master data
  // ---------------------------------------------------------------

  const firstNames = [
    "Aditya",
    "Akash",
    "Aman",
    "Aarav",
    "Arjun",
    "Ayush",
    "Dev",
    "Dhruv",
    "Ishaan",
    "Karan",
    "Kabir",
    "Krish",
    "Manav",
    "Mohit",
    "Nikhil",
    "Nitin",
    "Pranav",
    "Rahul",
    "Rajat",
    "Rohan",
    "Sahil",
    "Sameer",
    "Siddharth",
    "Tanmay",
    "Varun",
    "Vikram",
    "Yash",
    "Ananya",
    "Aditi",
    "Aisha",
    "Diya",
    "Isha",
    "Kavya",
    "Kiara",
    "Meera",
    "Naina",
    "Neha",
    "Pooja",
    "Priya",
    "Riya",
    "Sakshi",
    "Shreya",
    "Simran",
    "Sneha",
    "Tanya",
    "Trisha",
    "Vidhi",
    "Zoya",
    "Maya",
    "Avni"
  ];

  const lastNames = [
    "Shah",
    "Patel",
    "Mehta",
    "Desai",
    "Joshi",
    "Sharma",
    "Verma",
    "Iyer",
    "Nair",
    "Kapoor",
    "Malhotra",
    "Agarwal",
    "Gupta",
    "Reddy",
    "Rao",
    "Kulkarni",
    "Bhat",
    "Menon",
    "Chauhan",
    "Sinha"
  ];


  // ---------------------------------------------------------------
  // 2. Department / position / salary configuration
  // ---------------------------------------------------------------

  const departments = [
    {
      department: "Engineering",
      positions: [
        "Software Engineer",
        "Senior Software Engineer",
        "Developer",
        "Tech Lead",
        "Engineering Manager"
      ],
      base: 65000
    },

    {
      department: "Sales",
      positions: [
        "Sales Executive",
        "Senior Sales Executive",
        "Sales Manager",
        "Account Executive"
      ],
      base: 52000
    },

    {
      department: "Operations",
      positions: [
        "Operations Executive",
        "Operations Analyst",
        "Operations Manager"
      ],
      base: 47000
    },

    {
      department: "Finance",
      positions: [
        "Accountant",
        "Financial Analyst",
        "Payroll Specialist",
        "Finance Manager"
      ],
      base: 56000
    },

    {
      department: "Human Resources",
      positions: [
        "HR Executive",
        "HR Officer",
        "Recruiter",
        "HR Manager"
      ],
      base: 50000
    },

    {
      department: "IT",
      positions: [
        "IT Support Engineer",
        "System Administrator",
        "IT Manager"
      ],
      base: 58000
    },

    {
      department: "Marketing",
      positions: [
        "Marketing Executive",
        "Content Specialist",
        "Marketing Manager"
      ],
      base: 48000
    },

    {
      department: "Customer Support",
      positions: [
        "Support Executive",
        "Support Engineer",
        "Support Lead"
      ],
      base: 42000
    },

    {
      department: "Administration",
      positions: [
        "Admin Executive",
        "Office Administrator",
        "Admin Manager"
      ],
      base: 40000
    }
  ];


  // ---------------------------------------------------------------
  // 3. Prevent duplicate employees
  // ---------------------------------------------------------------

  const existingEmails = new Set(
    (
      await prisma.employee.findMany({
        select: {
          email: true
        }
      })
    ).map((employee) => employee.email)
  );


  // ---------------------------------------------------------------
  // 4. Additional Salary Structures
  // ---------------------------------------------------------------

  const structureConfigs = [
    {
      name: "Senior Professional",

      rules: [
        {
          name: "Basic Salary",
          code: "BASIC",
          category: "BASIC",
          sequence: 1,
          calculationType: "FIXED",
          value: 100000
        },

        {
          name: "House Rent Allowance",
          code: "HRA",
          category: "ALLOWANCE",
          sequence: 2,
          calculationType: "PERCENTAGE",
          value: 30,
          baseRuleCode: "BASIC"
        },

        {
          name: "Special Allowance",
          code: "SPECIAL",
          category: "ALLOWANCE",
          sequence: 3,
          calculationType: "PERCENTAGE",
          value: 10,
          baseRuleCode: "BASIC"
        },

        {
          name: "Provident Fund",
          code: "PF",
          category: "DEDUCTION",
          sequence: 4,
          calculationType: "PERCENTAGE",
          value: 12,
          baseRuleCode: "BASIC"
        },

        {
          name: "Net Salary",
          code: "NET",
          category: "NET",
          sequence: 5,
          calculationType: "FORMULA",
          formula: "BASIC + HRA + SPECIAL - PF"
        }
      ]
    },


    {
      name: "Management",

      rules: [
        {
          name: "Basic Salary",
          code: "BASIC",
          category: "BASIC",
          sequence: 1,
          calculationType: "FIXED",
          value: 150000
        },

        {
          name: "House Rent Allowance",
          code: "HRA",
          category: "ALLOWANCE",
          sequence: 2,
          calculationType: "PERCENTAGE",
          value: 35,
          baseRuleCode: "BASIC"
        },

        {
          name: "Management Allowance",
          code: "MGT",
          category: "ALLOWANCE",
          sequence: 3,
          calculationType: "PERCENTAGE",
          value: 15,
          baseRuleCode: "BASIC"
        },

        {
          name: "Provident Fund",
          code: "PF",
          category: "DEDUCTION",
          sequence: 4,
          calculationType: "PERCENTAGE",
          value: 12,
          baseRuleCode: "BASIC"
        },

        {
          name: "Net Salary",
          code: "NET",
          category: "NET",
          sequence: 5,
          calculationType: "FORMULA",
          formula: "BASIC + HRA + MGT - PF"
        }
      ]
    },


    {
      name: "Sales & Commission",

      rules: [
        {
          name: "Basic Salary",
          code: "BASIC",
          category: "BASIC",
          sequence: 1,
          calculationType: "FIXED",
          value: 55000
        },

        {
          name: "House Rent Allowance",
          code: "HRA",
          category: "ALLOWANCE",
          sequence: 2,
          calculationType: "PERCENTAGE",
          value: 20,
          baseRuleCode: "BASIC"
        },

        {
          name: "Sales Allowance",
          code: "SALES",
          category: "ALLOWANCE",
          sequence: 3,
          calculationType: "PERCENTAGE",
          value: 8,
          baseRuleCode: "BASIC"
        },

        {
          name: "Provident Fund",
          code: "PF",
          category: "DEDUCTION",
          sequence: 4,
          calculationType: "PERCENTAGE",
          value: 12,
          baseRuleCode: "BASIC"
        },

        {
          name: "Net Salary",
          code: "NET",
          category: "NET",
          sequence: 5,
          calculationType: "FORMULA",
          formula: "BASIC + HRA + SALES - PF"
        }
      ]
    }
  ];


  const extendedStructures = {};


  for (const config of structureConfigs) {

    const structure =
      await prisma.salaryStructure.upsert({

        where: {
          name: config.name
        },

        update: {},

        create: {
          name: config.name
        }
      });


    extendedStructures[config.name] = structure;


    for (const rule of config.rules) {

      const exists =
        await prisma.salaryRule.findFirst({

          where: {
            salaryStructureId: structure.id,
            code: rule.code
          }
        });


      if (!exists) {

        await prisma.salaryRule.create({

          data: {
            salaryStructureId: structure.id,
            ...rule
          }

        });

      }

    }

  }


  // ---------------------------------------------------------------
  // 5. Additional Working Schedules
  // ---------------------------------------------------------------

  const scheduleConfigs = [

    {
      name: "Flexible 10-7",
      start: "10:00",
      end: "19:00",
      breakMinutes: 60
    },

    {
      name: "Morning Shift",
      start: "07:00",
      end: "16:00",
      breakMinutes: 60
    },

    {
      name: "Evening Shift",
      start: "14:00",
      end: "23:00",
      breakMinutes: 60
    },

    {
      name: "Weekend Support",
      start: "09:00",
      end: "18:00",
      breakMinutes: 60
    }

  ];


  const extendedSchedules = {};


  for (const config of scheduleConfigs) {

    let schedule =
      await prisma.workingSchedule.findFirst({

        where: {
          name: config.name
        }
      });


    if (!schedule) {

      const days =
        config.name === "Weekend Support"
          ? [0, 6]
          : [1, 2, 3, 4, 5];


      schedule =
        await prisma.workingSchedule.create({

          data: {

            name: config.name,

            totalWeeklyHours:
              days.length * 8,

            shifts: {

              create: days.map(
                (dayOfWeek) => ({

                  dayOfWeek,

                  startTime:
                    config.start,

                  endTime:
                    config.end,

                  breakMinutes:
                    config.breakMinutes

                })
              )

            }

          }

        });

    }


    extendedSchedules[config.name] =
      schedule;

  }


  // ---------------------------------------------------------------
  // 6. Additional Leave Types
  // ---------------------------------------------------------------

  const leaveConfigs = [

    {
      name: "Casual Leave",
      unit: "DAYS",
      requiresApproval: true,
      tracksBalance: true
    },

    {
      name: "Unpaid Leave",
      unit: "DAYS",
      requiresApproval: true,
      tracksBalance: false
    },

    {
      name: "Work From Home",
      unit: "DAYS",
      requiresApproval: true,
      tracksBalance: true
    }

  ];


  const allTimeOffTypes = {};


  for (const config of leaveConfigs) {

    let type =
      await prisma.timeOffType.findFirst({

        where: {
          name: config.name
        }

      });


    if (!type) {

      type =
        await prisma.timeOffType.create({

          data: config

        });

    }


    allTimeOffTypes[config.name] =
      type;

  }


  const ptoType =
    await prisma.timeOffType.findFirst({

      where: {
        name: "Paid Time Off"
      }

    });


  const sickType =
    await prisma.timeOffType.findFirst({

      where: {
        name: "Sick Leave"
      }

    });


  // ---------------------------------------------------------------
  // 7. Create 100 Additional Employees
  // ---------------------------------------------------------------

  const newEmployees = [];

  let nameIndex = 0;


  for (let i = 1; i <= 100; i++) {

    let departmentConfig =
      pick(departments);


    // Controlled distribution.
    if (i <= 40) {
      departmentConfig =
        departments[0];
    }

    else if (i <= 55) {
      departmentConfig =
        departments[1];
    }

    else if (i <= 67) {
      departmentConfig =
        departments[2];
    }

    else if (i <= 75) {
      departmentConfig =
        departments[3];
    }

    else if (i <= 81) {
      departmentConfig =
        departments[4];
    }

    else if (i <= 86) {
      departmentConfig =
        departments[5];
    }

    else if (i <= 90) {
      departmentConfig =
        departments[6];
    }

    else if (i <= 97) {
      departmentConfig =
        departments[7];
    }

    else {
      departmentConfig =
        departments[8];
    }


    const first =
      firstNames[
        nameIndex % firstNames.length
      ];

    nameIndex++;


    const last =
      lastNames[
        (i * 7) % lastNames.length
      ];


    const email =
      `demo.employee${String(i).padStart(3, "0")}@oxp.com`;


    if (existingEmails.has(email)) {
      continue;
    }


    const position =
      pick(departmentConfig.positions);


    const wage =
      Math.round(
        (
          departmentConfig.base +
          int(-7000, 22000)
        ) / 500
      ) * 500;


    const employee =
      await prisma.employee.create({

        data: {

          name:
            `${first} ${last}`,

          email,

          department:
            departmentConfig.department,

          jobPosition:
            position,

          isActive:
            i <= 97

        }

      });


    existingEmails.add(email);

    newEmployees.push(employee);

  }


  // ---------------------------------------------------------------
  // 8. Build Manager Pool
  // ---------------------------------------------------------------

  const managerPool =
    await prisma.employee.findMany({

      where: {

        OR: [

          {
            jobPosition: {
              contains: "Manager"
            }
          },

          {
            jobPosition: {
              contains: "Lead"
            }
          }

        ]

      }

    });


  // ---------------------------------------------------------------
  // 9. Assign Managers + Working Schedules
  // ---------------------------------------------------------------

  const schedulePool = [

    standardSchedule,

    extendedSchedules["Flexible 10-7"],

    extendedSchedules["Morning Shift"],

    extendedSchedules["Evening Shift"],

    extendedSchedules["Weekend Support"]

  ].filter(Boolean);


  for (
    let index = 0;
    index < newEmployees.length;
    index++
  ) {

    const employee =
      newEmployees[index];


    const manager =
      managerPool.length
        ? pick(managerPool)
        : null;


    const schedule =
      schedulePool[
        index % schedulePool.length
      ];


    await prisma.employee.update({

      where: {
        id: employee.id
      },

      data: {

        managerId:
          manager &&
          manager.id !== employee.id
            ? manager.id
            : null,

        workingScheduleId:
          schedule
            ? schedule.id
            : null

      }

    });

  }


  // ---------------------------------------------------------------
  // 10. Create Historical + Active Contracts
  // ---------------------------------------------------------------

  const activeContracts = [];


  for (
    let index = 0;
    index < newEmployees.length;
    index++
  ) {

    const employee =
      newEmployees[index];


    const departmentConfig =
      departments.find(
        (department) =>
          department.department ===
          employee.department
      ) || departments[0];


    let structureName =
      "Regular Full-Time";


    if (
      employee.jobPosition.includes(
        "Manager"
      ) ||
      employee.jobPosition.includes(
        "Lead"
      )
    ) {

      structureName =
        "Management";

    }

    else if (
      employee.department ===
      "Sales"
    ) {

      structureName =
        "Sales & Commission";

    }

    else if (
      employee.jobPosition.includes(
        "Senior"
      )
    ) {

      structureName =
        "Senior Professional";

    }


    const structure =
      structureName ===
      "Regular Full-Time"

        ? salaryStructure

        : extendedStructures[
            structureName
          ];


    const baseWage =
      Math.round(
        (
          departmentConfig.base +
          int(-5000, 18000)
        ) / 500
      ) * 500;


    // Every fourth employee gets a historical contract.
    if (index % 4 === 0) {

      const oldWage =
        Math.round(
          (baseWage * 0.88) / 500
        ) * 500;


      await prisma.contract.create({

        data: {

          employeeId:
            employee.id,

          startDate:
            new Date(
              "2025-01-01"
            ),

          endDate:
            new Date(
              "2025-12-31"
            ),

          wage:
            oldWage,

          department:
            employee.department,

          position:
            employee.jobPosition,

          salaryStructureId:
            structure.id,

          status:
            "EXPIRED"

        }

      });

    }


    const contract =
      await prisma.contract.create({

        data: {

          employeeId:
            employee.id,

          startDate:
            new Date(
              "2026-01-01"
            ),

          endDate:
            null,

          wage:
            baseWage,

          department:
            employee.department,

          position:
            employee.jobPosition,

          salaryStructureId:
            structure.id,

          status:
            "ACTIVE"

        }

      });


    activeContracts.push(contract);

  }


  // ---------------------------------------------------------------
  // 11. Leave Allocations
  // ---------------------------------------------------------------

  const allocationByEmployee =
    new Map();


  for (
    let index = 0;
    index < newEmployees.length;
    index++
  ) {

    const employee =
      newEmployees[index];


    const allocations = [];


    const allocationConfigs = [

      {
        type: ptoType,
        quota: int(18, 28)
      },

      {
        type: sickType,
        quota: int(7, 14)
      },

      {
        type:
          allTimeOffTypes[
            "Casual Leave"
          ],

        quota: int(6, 12)
      },

      {
        type:
          allTimeOffTypes[
            "Work From Home"
          ],

        quota: int(8, 18)
      }

    ];


    for (
      const config
      of allocationConfigs
    ) {

      if (!config.type) {
        continue;
      }


      const allocation =
        await prisma.timeOffAllocation.create({

          data: {

            employeeId:
              employee.id,

            timeOffTypeId:
              config.type.id,

            quota:
              config.quota,

            remaining:
              config.quota,

            validFrom:
              new Date(
                "2026-01-01"
              ),

            validTo:
              new Date(
                "2026-12-31"
              ),

            approvedByHR:
              true

          }

        });


      allocations.push(
        allocation
      );

    }


    allocationByEmployee.set(
      employee.id,
      allocations
    );

  }


  // ---------------------------------------------------------------
  // 12. Leave Requests
  // ---------------------------------------------------------------

  const requestStatuses = [

    "APPROVED",
    "APPROVED",
    "APPROVED",
    "PENDING",
    "REFUSED"

  ];


  const hrUser =
    await prisma.user.findFirst({

      where: {
        role: "HR_MANAGER"
      }

    });


  for (
    let index = 0;
    index < newEmployees.length;
    index++
  ) {

    const employee =
      newEmployees[index];


    const allocations =
      allocationByEmployee.get(
        employee.id
      ) || [];


    const usable =
      allocations.filter(
        (allocation) =>
          Number(allocation.remaining) > 0
      );


    if (!usable.length) {
      continue;
    }


    // Two requests per employee.
    for (let r = 0; r < 2; r++) {

      const allocation =
        pick(usable);


      const status =
        requestStatuses[
          (index + r) %
          requestStatuses.length
        ];


      const duration =
        int(
          1,
          Math.min(
            3,
            Number(
              allocation.remaining
            )
          )
        );


      const startDay =
        int(5, 24);


      const month =
        ((index + r) % 8) + 1;


      const start =
        dateAt(
          2026,
          month,
          startDay
        );


      const end =
        dateAt(
          2026,
          month,
          Math.min(
            startDay +
              duration -
              1,
            28
          )
        );


      await prisma.timeOffRequest.create({

        data: {

          employeeId:
            employee.id,

          timeOffTypeId:
            allocation.timeOffTypeId,

          startDate:
            start,

          endDate:
            end,

          reason:
            pick([

              "Personal work",

              "Family commitment",

              "Medical appointment",

              "Planned vacation",

              "Work from home request"

            ]),

          status,

          approvedById:
            status === "PENDING"
              ? null
              : (
                  hrUser
                    ? hrUser.id
                    : null
                ),

          decidedAt:
            status === "PENDING"
              ? null
              : new Date()

        }

      });


      // Approved leave reduces remaining balance.
      if (
        status === "APPROVED"
      ) {

        await prisma.timeOffAllocation.update({

          where: {
            id: allocation.id
          },

          data: {

            remaining:
              Math.max(
                0,
                Number(
                  allocation.remaining
                ) - duration
              )

          }

        });


        allocation.remaining =
          Math.max(
            0,
            Number(
              allocation.remaining
            ) - duration
          );

      }

    }

  }


  // ---------------------------------------------------------------
  // 13. Attendance History
  // ---------------------------------------------------------------

  // 15 days of August 2026.
  for (
    let day = 1;
    day <= 15;
    day++
  ) {

    const current =
      dateAt(
        2026,
        8,
        day
      );


    const weekday =
      current.getDay();


    // Skip weekends.
    if (
      weekday === 0 ||
      weekday === 6
    ) {
      continue;
    }


    for (
      let index = 0;
      index < newEmployees.length;
      index++
    ) {

      const employee =
        newEmployees[index];


      let status =
        "PRESENT";


      let checkInHour =
        9;


      let checkInMinute =
        int(0, 12);


      let checkOutHour =
        18;


      let checkOutMinute =
        int(0, 15);


      /*
       * Deliberate demo scenarios:
       *
       * 0-3   = ABSENT
       * 4-10  = LATE
       * 11-14 = OVERTIME
       * 15-17 = MISSING_CHECKOUT
       * rest  = PRESENT
       */

      const scenario =
        (index + day) % 100;


      if (scenario < 4) {

        status =
          "ABSENT";

        checkInHour = 9;

        checkInMinute = 0;

      }


      else if (scenario < 11) {

        status =
          "LATE";

        checkInHour = 9;

        checkInMinute =
          int(16, 45);

      }


      else if (scenario < 15) {

        status =
          "OVERTIME";

        checkInHour = 8;

        checkInMinute =
          int(30, 59);

        checkOutHour = 20;

        checkOutMinute =
          int(0, 30);

      }


      else if (scenario < 18) {

        status =
          "MISSING_CHECKOUT";

      }


      const checkIn =
        dateAt(
          2026,
          8,
          day,
          checkInHour,
          checkInMinute
        );


      let checkOut = null;


      if (
        status ===
        "PRESENT" ||
        status ===
        "LATE" ||
        status ===
        "OVERTIME"
      ) {

        checkOut =
          dateAt(
            2026,
            8,
            day,
            checkOutHour,
            checkOutMinute
          );

      }


      let workedHours = null;


      if (checkOut) {

        workedHours =
          Math.max(
            0,
            (
              (
                checkOut -
                checkIn
              ) / 3600000
            ) - 1
          );

      }


      await prisma.attendance.create({

        data: {

          employeeId:
            employee.id,

          checkIn,

          checkOut,

          workedHours,

          status

        }

      });

    }

  }


  // ---------------------------------------------------------------
  // 14. Historical Payruns
  // ---------------------------------------------------------------

  const allStructures =
    await prisma.salaryStructure.findMany({

      include: {

        rules: {

          orderBy: {
            sequence: "asc"
          }

        }

      }

    });


  const structureMap =
    new Map(
      allStructures.map(
        (structure) => [
          structure.id,
          structure
        ]
      )
    );


  // ---------------------------------------------------------------
  // 15. Seed Payslip Calculation
  // ---------------------------------------------------------------

  const computeSeedPayslip =
    (
      contract,
      structure
    ) => {

      const amounts = {};

      const lines = [];


      for (
        const rule
        of structure.rules
      ) {

        let amount = 0;


        // FIXED
        if (
          rule.calculationType ===
          "FIXED"
        ) {

          amount =
            rule.code === "BASIC"

              ? Number(
                  contract.wage
                )

              : (
                  rule.value != null
                    ? Number(
                        rule.value
                      )
                    : 0
                );

        }


        // PERCENTAGE
        else if (
          rule.calculationType ===
          "PERCENTAGE"
        ) {

          amount =
            (
              amounts[
                rule.baseRuleCode
              ] ?? 0
            ) *
            (
              Number(
                rule.value
              ) || 0
            ) /
            100;

        }


        // FORMULA
        else if (
          rule.calculationType ===
          "FORMULA"
        ) {

          const tokens =
            (
              rule.formula || ""
            )
              .replace(
                /\s+/g,
                ""
              )
              .match(
                /[A-Za-z_][A-Za-z_0-9]*|[+\-]/g
              ) || [];


          let total = 0;

          let sign = 1;


          for (
            const token
            of tokens
          ) {

            if (token === "+") {

              sign = 1;

            }

            else if (
              token === "-"
            ) {

              sign = -1;

            }

            else {

              total +=
                sign *
                (
                  amounts[token] ??
                  0
                );

            }

          }


          amount =
            total;

        }


        amounts[
          rule.code
        ] = amount;


        lines.push({

          salaryRuleId:
            rule.id,

          sequence:
            rule.sequence,

          category:
            rule.category,

          amount

        });

      }


      const gross =
        lines

          .filter(
            (line) =>
              line.category ===
                "BASIC" ||
              line.category ===
                "ALLOWANCE"
          )

          .reduce(
            (
              sum,
              line
            ) =>
              sum +
              Number(
                line.amount
              ),
            0
          );


      const deductions =
        lines

          .filter(
            (line) =>
              line.category ===
              "DEDUCTION"
          )

          .reduce(
            (
              sum,
              line
            ) =>
              sum +
              Number(
                line.amount
              ),
            0
          );


      const net =
        Number(
          amounts.NET ??
          (
            gross -
            deductions
          )
        );


      return {

        gross,

        deductions,

        net,

        lines

      };

    };


  // ---------------------------------------------------------------
  // 16. Payrun periods
  // ---------------------------------------------------------------

  const periods = [

    {
      start:
        "2026-03-01",

      end:
        "2026-03-31",

      state:
        "PAID"
    },

    {
      start:
        "2026-04-01",

      end:
        "2026-04-30",

      state:
        "PAID"
    },

    {
      start:
        "2026-05-01",

      end:
        "2026-05-31",

      state:
        "PAID"
    },

    {
      start:
        "2026-07-01",

      end:
        "2026-07-31",

      state:
        "PAID"
    },

    {
      start:
        "2026-08-01",

      end:
        "2026-08-31",

      state:
        "COMPUTED"
    }

  ];


  // ---------------------------------------------------------------
  // 17. Generate Payruns + Payslips
  // ---------------------------------------------------------------

  for (
    const period
    of periods
  ) {

    const periodStart =
      new Date(
        period.start
      );


    const periodEnd =
      new Date(
        period.end
      );


    // Find existing payrun first.
    let batch =
      await prisma.payrunBatch.findFirst({

        where: {
          periodStart
        }

      });


    // Create if it doesn't exist.
    if (!batch) {

      batch =
        await prisma.payrunBatch.create({

          data: {

            periodStart,

            periodEnd,

            salaryStructureId:
              salaryStructure.id,

            state:
              period.state,

            computedAt:
              new Date()

          }

        });

    }


    // Find contracts active during this period.
    const contracts =
      await prisma.contract.findMany({

        where: {

          status:
            "ACTIVE",

          startDate: {
            lte: periodEnd
          },

          OR: [

            {
              endDate: null
            },

            {
              endDate: {
                gte: periodStart
              }
            }

          ]

        }

      });


    for (
      const contract
      of contracts
    ) {

      // Avoid duplicate payslips.
      const duplicate =
        await prisma.payslip.findUnique({

          where: {

            payrunBatchId_employeeId: {

              payrunBatchId:
                batch.id,

              employeeId:
                contract.employeeId

            }

          }

        });


      if (duplicate) {
        continue;
      }


      const structure =
        structureMap.get(
          contract.salaryStructureId
        ) ||
        salaryStructure;


      const computed =
        computeSeedPayslip(
          contract,
          structure
        );


      const payslip =
        await prisma.payslip.create({

          data: {

            payrunBatchId:
              batch.id,

            employeeId:
              contract.employeeId,

            contractId:
              contract.id,

            grossTotal:
              computed.gross,

            deductionTotal:
              computed.deductions,

            netTotal:
              computed.net,

            deliveryStatus:
              period.state ===
              "PAID"

                ? "SENT"

                : "PENDING"

          }

        });


      // Create salary breakdown lines.
      await prisma.payslipLine.createMany({

        data:

          computed.lines.map(
            (line) => ({

              ...line,

              payslipId:
                payslip.id

            })
          )

      });

    }

  }


  // ---------------------------------------------------------------
  // 18. Final output
  // ---------------------------------------------------------------

  console.log(
    "✅ Extended demo data complete."
  );

  console.log(
    `   Added employees: ${newEmployees.length}`
  );

  console.log(
    "   Added historical/current contracts."
  );

  console.log(
    "   Added working schedules."
  );

  console.log(
    "   Added leave allocations + requests."
  );

  console.log(
    "   Added attendance history."
  );

  console.log(
    "   Added historical payroll data."
  );

  console.log(
    "   Added payslips + payslip lines."
  );

  console.log(
    "   Deterministic demo seed: " +
    DEMO_SEED
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
