require("dotenv").config();
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const app = express();

app.use(cors());
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;

// ---------- RBAC: role short-code → permission matrix (API.md §12) ----------
// Each entry maps an API route pattern to the roles allowed to call it.
// Server-side enforcement — the frontend only hides UI, never trusts it.
const ROLES = {
  EMP: "EMPLOYEE",
  HRM: "HR_MANAGER",
  HPU: "HR_PAYROLL_USER",
  HPM: "HR_PAYROLL_MANAGER",
  ADM: "ADMIN",
};

// Route allow-lists. Format: { method, path, roles[] }
const PERMISSIONS = [
  { method: "POST", path: "/api/auth/login", roles: ["PUBLIC"] },
  { method: "GET", path: "/api/health", roles: ["PUBLIC"] },
  { method: "POST", path: "/api/auth/logout", roles: ["AUTH"] },
  { method: "GET", path: "/api/auth/me", roles: ["AUTH"] },
  { method: "POST", path: "/api/auth/users", roles: [ROLES.ADM] },
  { method: "GET", path: "/api/auth/users", roles: [ROLES.ADM] },
  { method: "PATCH", path: "/api/auth/users/:id", roles: [ROLES.ADM] },
  { method: "DELETE", path: "/api/auth/users/:id", roles: [ROLES.ADM] },
  // Employees (API.md §1)
  { method: "POST", path: "/api/employees", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/employees", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/employees/me", roles: [ROLES.EMP] },
  { method: "GET", path: "/api/employees/:id", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM, ROLES.EMP] },
  { method: "PATCH", path: "/api/employees/:id", roles: [ROLES.HRM, ROLES.HPM, ROLES.ADM] },
  { method: "DELETE", path: "/api/employees/:id", roles: [ROLES.ADM] },
  { method: "GET", path: "/api/employees/:id/contracts", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM, ROLES.EMP] },
  { method: "GET", path: "/api/employees/:id/attendance", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM, ROLES.EMP] },
  { method: "GET", path: "/api/employees/:id/time-off", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM, ROLES.EMP] },
  // Contracts (API.md §2) — /active and /validate-overlap must be listed BEFORE :id
  { method: "POST", path: "/api/contracts", roles: [ROLES.HRM, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/contracts", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/contracts/active", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "POST", path: "/api/contracts/validate-overlap", roles: [ROLES.HRM, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/contracts/:id", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM, ROLES.EMP] },
  { method: "PATCH", path: "/api/contracts/:id", roles: [ROLES.HRM, ROLES.HPM, ROLES.ADM] },
  { method: "DELETE", path: "/api/contracts/:id", roles: [ROLES.ADM] },
  // Salary structures — minimal read-only for contract form picker (full CRUD in Phase 8)
  { method: "GET", path: "/api/salary-structures", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  // Working Schedules (API.md §3)
  { method: "POST", path: "/api/schedules", roles: [ROLES.HRM, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/schedules", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/schedules/:id", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM, ROLES.EMP] },
  { method: "PATCH", path: "/api/schedules/:id", roles: [ROLES.HRM, ROLES.HPM, ROLES.ADM] },
  { method: "DELETE", path: "/api/schedules/:id", roles: [ROLES.ADM] },
  // Time Off Types (API.md §5)
  { method: "POST", path: "/api/time-off/types", roles: [ROLES.HRM, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/time-off/types", roles: ["AUTH"] },
  { method: "GET", path: "/api/time-off/types/:id", roles: ["AUTH"] },
  { method: "PATCH", path: "/api/time-off/types/:id", roles: [ROLES.HRM, ROLES.HPM, ROLES.ADM] },
  { method: "DELETE", path: "/api/time-off/types/:id", roles: [ROLES.ADM] },
];

// Exact-match helper: does this method+path match a permission entry?
// Supports `:param` placeholders in route definitions.
function matchesRoute(permMethod, permPath, reqMethod, reqPath) {
  if (permMethod !== reqMethod) return false;
  const permParts = permPath.split("/").filter(Boolean);
  const reqParts = reqPath.split("/").filter(Boolean);
  if (permParts.length !== reqParts.length) return false;
  return permParts.every((p, i) => p.startsWith(":") || p === reqParts[i]);
}

// ---------- Auth middleware ----------
// 1. Verify JWT → resolve user + role
// 2. Check role against PERMISSIONS for this endpoint
// 3. Attach req.user for downstream handlers
function authMiddleware(req, res, next) {
  const perm = PERMISSIONS.find((p) =>
    matchesRoute(p.method, p.path, req.method, req.path)
  );

  if (!perm) {
    return res.status(404).json({
      data: null,
      error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` },
    });
  }

  // Public routes need no token
  if (perm.roles.includes("PUBLIC")) return next();

  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ data: null, error: { code: "UNAUTHORIZED", message: "Missing token" } });
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET);
    req.user = payload;

    // Any authenticated user for "AUTH" routes
    if (perm.roles.includes("AUTH")) return next();

    // RBAC check → 403 if role not allowed
    if (!perm.roles.includes(payload.role)) {
      return res
        .status(403)
        .json({ data: null, error: { code: "FORBIDDEN", message: "Access denied" } });
    }

    next();
  } catch (e) {
    return res
      .status(401)
      .json({ data: null, error: { code: "UNAUTHORIZED", message: "Invalid token" } });
  }
}

app.use(authMiddleware);

// ---------- Auth routes ----------

// POST /api/auth/login — public, issues JWT
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      return res
        .status(401)
        .json({ data: null, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res
        .status(401)
        .json({ data: null, error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password" } });
    }
    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role, employeeId: user.employeeId },
      JWT_SECRET,
      { expiresIn: "12h" }
    );
    return res.json({
      data: {
        token,
        user: { id: user.id, email: user.email, role: user.role, employeeId: user.employeeId },
      },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// POST /api/auth/logout — stateless JWT, just client drops token
app.post("/api/auth/logout", (req, res) => {
  return res.json({ data: { success: true } });
});

// GET /api/auth/me — returns current user for route guards
app.get("/api/auth/me", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { id: true, email: true, role: true, employeeId: true },
    });
    if (!user) {
      return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "User not found" } });
    }
    return res.json({ data: { user, role: user.role, employeeId: user.employeeId } });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// User management (Admin only) — POST /api/auth/users
app.post("/api/auth/users", async (req, res) => {
  try {
    const { email, password, role, employeeId } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, role, employeeId },
      select: { id: true, email: true, role: true, employeeId: true },
    });
    return res.status(201).json({ data: user });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// GET /api/auth/users — Admin lists all users
app.get("/api/auth/users", async (_req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: { id: true, email: true, role: true, employeeId: true, isActive: true, createdAt: true },
    });
    return res.json({ data: users });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// PATCH /api/auth/users/:id — Admin updates role/active
app.patch("/api/auth/users/:id", async (req, res) => {
  try {
    const { role, isActive } = req.body;
    const user = await prisma.user.update({
      where: { id: req.params.id },
      data: { ...(role && { role }), ...(isActive !== undefined && { isActive }) },
      select: { id: true, email: true, role: true, employeeId: true, isActive: true },
    });
    return res.json({ data: user });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// DELETE /api/auth/users/:id — Admin deactivates login
app.delete("/api/auth/users/:id", async (req, res) => {
  try {
    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    return res.json({ data: { success: true } });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// GET /api/health — public uptime/DB check
app.get("/api/health", async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ data: { status: "ok", db: "connected" } });
  } catch (e) {
    return res.status(500).json({ data: { status: "error", db: "disconnected" } });
  }
});

// ---------- Employee routes (API.md §1) ----------

// EMP is allowed past middleware, but only for their own profile (self-check).
function assertSelfOrHR(req, res) {
  if (req.user.role === ROLES.EMP && req.user.employeeId !== req.params.id) {
    res.status(403).json({ data: null, error: { code: "FORBIDDEN", message: "Access denied" } });
    return false;
  }
  return true;
}

// POST /api/employees — create
app.post("/api/employees", async (req, res) => {
  try {
    const { name, email, department, jobPosition, managerId, workingScheduleId } = req.body;
    const employee = await prisma.employee.create({
      data: { name, email, department, jobPosition, managerId, workingScheduleId },
    });
    return res.status(201).json({ data: employee });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// GET /api/employees — list with filters (department, isActive, search)
app.get("/api/employees", async (req, res) => {
  try {
    const { department, isActive, search } = req.query;
    const where = {};
    if (department) where.department = department;
    if (isActive !== undefined) where.isActive = isActive === "true";
    if (search) where.name = { contains: search };
    const employees = await prisma.employee.findMany({
      where,
      include: { manager: { select: { id: true, name: true } } },
      orderBy: { name: "asc" },
    });
    return res.json({ data: employees });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// GET /api/employees/me — employee self profile (must be before :id)
app.get("/api/employees/me", async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.user.employeeId },
      include: { manager: { select: { id: true, name: true } } },
    });
    if (!employee) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Employee not found" } });
    return res.json({ data: employee });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// GET /api/employees/:id — detail with related counts (smart-nav badges)
app.get("/api/employees/:id", async (req, res) => {
  if (!assertSelfOrHR(req, res)) return;
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.params.id },
      include: {
        manager: { select: { id: true, name: true } },
        workingSchedule: true,
        _count: {
          select: { contracts: true, attendances: true, requests: true, allocations: true },
        },
      },
    });
    if (!employee) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Employee not found" } });
    return res.json({ data: employee });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// PATCH /api/employees/:id — update
app.patch("/api/employees/:id", async (req, res) => {
  try {
    const { name, email, department, jobPosition, managerId, workingScheduleId, isActive } = req.body;
    const employee = await prisma.employee.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(email && { email }),
        ...(department && { department }),
        ...(jobPosition && { jobPosition }),
        ...(managerId !== undefined && { managerId }),
        ...(workingScheduleId !== undefined && { workingScheduleId }),
        ...(isActive !== undefined && { isActive }),
      },
    });
    return res.json({ data: employee });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// DELETE /api/employees/:id — soft delete (isActive=false), Admin only
app.delete("/api/employees/:id", async (req, res) => {
  try {
    await prisma.employee.update({ where: { id: req.params.id }, data: { isActive: false } });
    return res.json({ data: { success: true } });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// GET /api/employees/:id/contracts — related contracts (smart-nav badge)
app.get("/api/employees/:id/contracts", async (req, res) => {
  if (!assertSelfOrHR(req, res)) return;
  try {
    const contracts = await prisma.contract.findMany({
      where: { employeeId: req.params.id },
      orderBy: { startDate: "desc" },
    });
    return res.json({ data: contracts });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// GET /api/employees/:id/attendance — related attendance records
app.get("/api/employees/:id/attendance", async (req, res) => {
  if (!assertSelfOrHR(req, res)) return;
  try {
    const { from, to } = req.query;
    const where = { employeeId: req.params.id };
    if (from || to) {
      where.checkIn = { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) };
    }
    const attendance = await prisma.attendance.findMany({
      where,
      orderBy: { checkIn: "desc" },
    });
    return res.json({ data: attendance });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// GET /api/employees/:id/time-off — related requests + allocations
app.get("/api/employees/:id/time-off", async (req, res) => {
  if (!assertSelfOrHR(req, res)) return;
  try {
    const [requests, allocations] = await Promise.all([
      prisma.timeOffRequest.findMany({
        where: { employeeId: req.params.id },
        include: { timeOffType: true },
        orderBy: { createdAt: "desc" },
      }),
      prisma.timeOffAllocation.findMany({
        where: { employeeId: req.params.id },
        include: { timeOffType: true },
        orderBy: { validFrom: "desc" },
      }),
    ]);
    return res.json({ data: { requests, allocations } });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// ---------- Contract routes (API.md §2) ----------
// NOTE: /active and /validate-overlap are registered before /:id so they are matched first.

// Shared helper: resolves the ACTIVE contract covering a date for an employee.
// Built once here, reused by the Payrun engine in later phases (TASKS.md guardrails).
function getActiveContract(employeeId, date = new Date()) {
  return prisma.contract.findFirst({
    where: {
      employeeId,
      status: "ACTIVE",
      startDate: { lte: date },
      OR: [{ endDate: null }, { endDate: { gte: date } }],
    },
    orderBy: { startDate: "desc" },
  });
}

// Overlap check (application constraint from DATABASE.md):
// no two ACTIVE contracts for same employee may overlap [startDate, endDate].
// Two ranges overlap when A.start <= B.end AND (A.end is null OR A.end >= B.start).
function hasOverlap(employeeId, startDate, endDate, excludeId) {
  return prisma.contract.findFirst({
    where: {
      employeeId,
      status: "ACTIVE",
      id: excludeId ? { not: excludeId } : undefined,
      startDate: { lte: endDate || new Date("9999-12-31") },
      OR: [{ endDate: null }, { endDate: { gte: startDate } }],
    },
  });
}

// GET /api/salary-structures — minimal read-only list (powers contract form picker)
app.get("/api/salary-structures", async (_req, res) => {
  try {
    const structures = await prisma.salaryStructure.findMany({ orderBy: { name: "asc" } });
    return res.json({ data: structures });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// POST /api/contracts — create (rejects on overlap)
app.post("/api/contracts", async (req, res) => {
  try {
    const { employeeId, startDate, endDate, wage, department, position, salaryStructureId, scheduleOverrideId, status } = req.body;
    const overlap = await hasOverlap(employeeId, new Date(startDate), endDate ? new Date(endDate) : null);
    if (overlap) {
      return res.status(400).json({
        data: null,
        error: {
          code: "OVERLAP",
          message: `Overlaps with existing ${overlap.status} contract (${overlap.startDate.toISOString().slice(0, 10)}${overlap.endDate ? " → " + overlap.endDate.toISOString().slice(0, 10) : " → open-ended"})`,
        },
      });
    }
    const contract = await prisma.contract.create({
      data: {
        employeeId,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        wage,
        department,
        position,
        salaryStructureId,
        scheduleOverrideId,
        status: status || "ACTIVE",
      },
      include: { employee: { select: { id: true, name: true } }, salaryStructure: true },
    });
    return res.status(201).json({ data: contract });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// GET /api/contracts — list with filters
app.get("/api/contracts", async (req, res) => {
  try {
    const { employeeId, status } = req.query;
    const where = {};
    if (employeeId) where.employeeId = employeeId;
    if (status) where.status = status;
    const contracts = await prisma.contract.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true } },
        salaryStructure: { select: { id: true, name: true } },
      },
      orderBy: [{ employeeId: "asc" }, { startDate: "desc" }],
    });
    return res.json({ data: contracts });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// GET /api/contracts/active — period-active contract for employee (reused by Payrun engine later)
app.get("/api/contracts/active", async (req, res) => {
  try {
    const { employeeId, date } = req.query;
    if (!employeeId) return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "employeeId required" } });
    const contract = await getActiveContract(employeeId, date ? new Date(date) : new Date());
    return res.json({ data: contract });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// POST /api/contracts/validate-overlap — pre-save check surfaced in UI before submit
app.post("/api/contracts/validate-overlap", async (req, res) => {
  try {
    const { employeeId, startDate, endDate, excludeContractId } = req.body;
    const overlap = await hasOverlap(employeeId, new Date(startDate), endDate ? new Date(endDate) : null, excludeContractId);
    return res.json({
      data: {
        overlap: !!overlap,
        conflictingContractId: overlap ? overlap.id : null,
        message: overlap ? `Overlaps with existing contract starting ${overlap.startDate.toISOString().slice(0, 10)}` : null,
      },
    });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// GET /api/contracts/:id — detail (EMP allowed only for own contract via self-check)
app.get("/api/contracts/:id", async (req, res) => {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: req.params.id },
      include: {
        employee: { select: { id: true, name: true } },
        salaryStructure: true,
        scheduleOverride: true,
      },
    });
    if (!contract) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Contract not found" } });
    if (req.user.role === ROLES.EMP && req.user.employeeId !== contract.employeeId) {
      return res.status(403).json({ data: null, error: { code: "FORBIDDEN", message: "Access denied" } });
    }
    return res.json({ data: contract });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// PATCH /api/contracts/:id — update, re-validates overlap on date/status change
app.patch("/api/contracts/:id", async (req, res) => {
  try {
    const existing = await prisma.contract.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Contract not found" } });

    const { startDate, endDate, wage, department, position, salaryStructureId, status } = req.body;
    const newStart = startDate ? new Date(startDate) : existing.startDate;
    const newEnd = endDate !== undefined ? (endDate ? new Date(endDate) : null) : existing.endDate;

    if ((startDate || endDate !== undefined || status) && status !== "CANCELLED") {
      const overlap = await hasOverlap(existing.employeeId, newStart, newEnd, existing.id);
      if (overlap) {
        return res.status(400).json({
          data: null,
          error: { code: "OVERLAP", message: "Update would overlap with an existing ACTIVE contract" },
        });
      }
    }

    const contract = await prisma.contract.update({
      where: { id: req.params.id },
      data: {
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(wage !== undefined && { wage }),
        ...(department && { department }),
        ...(position && { position }),
        ...(salaryStructureId && { salaryStructureId }),
        ...(status && { status }),
      },
      include: { employee: { select: { id: true, name: true } }, salaryStructure: true },
    });
    return res.json({ data: contract });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// DELETE /api/contracts/:id — Admin only, blocked if referenced by any Payslip
app.delete("/api/contracts/:id", async (req, res) => {
  try {
    const ref = await prisma.payslip.count({ where: { contractId: req.params.id } });
    if (ref > 0) {
      return res.status(400).json({ data: null, error: { code: "CANNOT_DELETE", message: "Contract is referenced by payslips" } });
    }
    await prisma.contract.delete({ where: { id: req.params.id } });
    return res.json({ data: { success: true } });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// ---------- Working Schedule routes (API.md §3) ----------

// Auto-compute total weekly hours from shift rows: sum of (end − start − break).
function computeWeeklyHours(shifts) {
  return shifts.reduce((total, s) => {
    const [sh, sm] = s.startTime.split(":").map(Number);
    const [eh, em] = s.endTime.split(":").map(Number);
    let minutes = eh * 60 + em - (sh * 60 + sm) - (s.breakMinutes || 0);
    if (minutes < 0) minutes = 0;
    return total + minutes / 60;
  }, 0);
}

// POST /api/schedules — create with nested shifts, totalWeeklyHours computed
app.post("/api/schedules", async (req, res) => {
  try {
    const { name, shifts } = req.body;
    const totalWeeklyHours = computeWeeklyHours(shifts || []);
    const schedule = await prisma.workingSchedule.create({
      data: {
        name,
        totalWeeklyHours,
        shifts: {
          create: (shifts || []).map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
            breakMinutes: s.breakMinutes || 0,
          })),
        },
      },
      include: { shifts: { orderBy: { dayOfWeek: "asc" } } },
    });
    return res.status(201).json({ data: schedule });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// GET /api/schedules — list
app.get("/api/schedules", async (_req, res) => {
  try {
    const schedules = await prisma.workingSchedule.findMany({
      include: {
        shifts: { orderBy: { dayOfWeek: "asc" } },
        _count: { select: { employees: true } },
      },
      orderBy: { name: "asc" },
    });
    return res.json({ data: schedules });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// GET /api/schedules/:id — detail (EMP allowed for their own assigned schedule)
app.get("/api/schedules/:id", async (req, res) => {
  try {
    const schedule = await prisma.workingSchedule.findUnique({
      where: { id: req.params.id },
      include: {
        shifts: { orderBy: { dayOfWeek: "asc" } },
        employees: { select: { id: true, name: true } },
      },
    });
    if (!schedule) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Schedule not found" } });
    if (req.user.role === ROLES.EMP) {
      const self = await prisma.employee.findUnique({ where: { id: req.user.employeeId } });
      const mine = self && (self.workingScheduleId === schedule.id || schedule.employees.some((e) => e.id === self.id));
      if (!mine) return res.status(403).json({ data: null, error: { code: "FORBIDDEN", message: "Access denied" } });
    }
    return res.json({ data: schedule });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// PATCH /api/schedules/:id — update name/shifts, recomputes totalWeeklyHours
app.patch("/api/schedules/:id", async (req, res) => {
  try {
    const { name, shifts } = req.body;
    const data = {};
    if (name) data.name = name;
    if (shifts) {
      data.totalWeeklyHours = computeWeeklyHours(shifts);
      // Replace shift set: delete existing, re-create from payload.
      await prisma.scheduleShift.deleteMany({ where: { workingScheduleId: req.params.id } });
      await prisma.scheduleShift.createMany({
        data: shifts.map((s) => ({
          workingScheduleId: req.params.id,
          dayOfWeek: s.dayOfWeek,
          startTime: s.startTime,
          endTime: s.endTime,
          breakMinutes: s.breakMinutes || 0,
        })),
      });
    }
    const schedule = await prisma.workingSchedule.update({
      where: { id: req.params.id },
      data,
      include: { shifts: { orderBy: { dayOfWeek: "asc" } } },
    });
    return res.json({ data: schedule });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// DELETE /api/schedules/:id — Admin only, blocked if assigned to any Employee/Contract
app.delete("/api/schedules/:id", async (req, res) => {
  try {
    const assigned = await prisma.employee.count({ where: { workingScheduleId: req.params.id } });
    const overridden = await prisma.contract.count({ where: { scheduleOverrideId: req.params.id } });
    if (assigned + overridden > 0) {
      return res.status(400).json({ data: null, error: { code: "CANNOT_DELETE", message: "Schedule is assigned to employees/contracts" } });
    }
    await prisma.scheduleShift.deleteMany({ where: { workingScheduleId: req.params.id } });
    await prisma.workingSchedule.delete({ where: { id: req.params.id } });
    return res.json({ data: { success: true } });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// ---------- Time Off Type routes (API.md §5) ----------

// POST /api/time-off/types — create
app.post("/api/time-off/types", async (req, res) => {
  try {
    const { name, unit, requiresApproval, tracksBalance } = req.body;
    const type = await prisma.timeOffType.create({
      data: { name, unit, requiresApproval: requiresApproval ?? true, tracksBalance: tracksBalance ?? true },
    });
    return res.status(201).json({ data: type });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// GET /api/time-off/types — list (all authenticated)
app.get("/api/time-off/types", async (_req, res) => {
  try {
    const types = await prisma.timeOffType.findMany({ orderBy: { name: "asc" } });
    return res.json({ data: types });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// GET /api/time-off/types/:id — detail
app.get("/api/time-off/types/:id", async (req, res) => {
  try {
    const type = await prisma.timeOffType.findUnique({ where: { id: req.params.id } });
    if (!type) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Time off type not found" } });
    return res.json({ data: type });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// PATCH /api/time-off/types/:id — update
app.patch("/api/time-off/types/:id", async (req, res) => {
  try {
    const { name, requiresApproval, tracksBalance } = req.body;
    const type = await prisma.timeOffType.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(requiresApproval !== undefined && { requiresApproval }),
        ...(tracksBalance !== undefined && { tracksBalance }),
      },
    });
    return res.json({ data: type });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// DELETE /api/time-off/types/:id — Admin only, blocked if referenced
app.delete("/api/time-off/types/:id", async (req, res) => {
  try {
    const allocations = await prisma.timeOffAllocation.count({ where: { timeOffTypeId: req.params.id } });
    const requests = await prisma.timeOffRequest.count({ where: { timeOffTypeId: req.params.id } });
    if (allocations + requests > 0) {
      return res.status(400).json({ data: null, error: { code: "CANNOT_DELETE", message: "Time off type is referenced by allocations/requests" } });
    }
    await prisma.timeOffType.delete({ where: { id: req.params.id } });
    return res.json({ data: { success: true } });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`PeoplePay360 backend running on http://localhost:${PORT}`);
});
