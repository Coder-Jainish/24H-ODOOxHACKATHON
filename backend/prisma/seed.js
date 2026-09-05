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

  // Basic salary structure rules (Basic, HRA, PF, Net) for future Phases
  await prisma.salaryRule.createMany({
    data: [
      {
        salaryStructureId: salaryStructure.id,
        name: "Basic Salary",
        code: "BASIC",
        category: "BASIC",
        sequence: 1,
        calculationType: "FIXED",
        value: 50000,
      },
      {
        salaryStructureId: salaryStructure.id,
        name: "House Rent Allowance",
        code: "HRA",
        category: "ALLOWANCE",
        sequence: 2,
        calculationType: "PERCENTAGE",
        value: 20,
        baseRuleCode: "BASIC",
      },
      {
        salaryStructureId: salaryStructure.id,
        name: "Provident Fund",
        code: "PF",
        category: "DEDUCTION",
        sequence: 3,
        calculationType: "PERCENTAGE",
        value: 12,
        baseRuleCode: "BASIC",
      },
      {
        salaryStructureId: salaryStructure.id,
        name: "Net Salary",
        code: "NET",
        category: "NET",
        sequence: 4,
        calculationType: "FORMULA",
        formula: "BASIC + HRA - PF",
      },
    ],
  });

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });