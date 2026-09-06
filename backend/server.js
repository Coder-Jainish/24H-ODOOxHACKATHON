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
  // Attendance (API.md §4)
  { method: "POST", path: "/api/attendance/check-in", roles: [ROLES.EMP] },
  { method: "POST", path: "/api/attendance/:id/check-out", roles: [ROLES.EMP] },
  { method: "GET", path: "/api/attendance", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/attendance/:id", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM, ROLES.EMP] },
  { method: "PATCH", path: "/api/attendance/:id", roles: [ROLES.HRM, ROLES.HPM, ROLES.ADM] },
  { method: "DELETE", path: "/api/attendance/:id", roles: [ROLES.ADM] },
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
  // Time Off Allocations (API.md §6)
  { method: "POST", path: "/api/time-off/allocations", roles: [ROLES.HRM, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/time-off/allocations", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/time-off/allocations/:id", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM, ROLES.EMP] },
  { method: "PATCH", path: "/api/time-off/allocations/:id", roles: [ROLES.HRM, ROLES.HPM, ROLES.ADM] },
  { method: "DELETE", path: "/api/time-off/allocations/:id", roles: [ROLES.ADM] },
  // Time Off Requests (API.md §7)
  { method: "POST", path: "/api/time-off/requests", roles: [ROLES.EMP] },
  { method: "GET", path: "/api/time-off/requests", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/time-off/requests/:id", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM, ROLES.EMP] },
  { method: "PATCH", path: "/api/time-off/requests/:id", roles: [ROLES.EMP] },
  { method: "DELETE", path: "/api/time-off/requests/:id", roles: [ROLES.EMP] },
  { method: "POST", path: "/api/time-off/requests/:id/approve", roles: [ROLES.HRM, ROLES.ADM] },
  { method: "POST", path: "/api/time-off/requests/:id/refuse", roles: [ROLES.HRM, ROLES.ADM] },
  // Salary Structures (API.md §8)
  { method: "POST", path: "/api/salary-structures", roles: [ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/salary-structures", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/salary-structures/:id", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "PATCH", path: "/api/salary-structures/:id", roles: [ROLES.HPM, ROLES.ADM] },
  { method: "DELETE", path: "/api/salary-structures/:id", roles: [ROLES.ADM] },
  // Salary Rules (API.md §9)
  { method: "POST", path: "/api/salary-rules", roles: [ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/salary-rules", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/salary-rules/:id", roles: [ROLES.HRM, ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "PATCH", path: "/api/salary-rules/:id", roles: [ROLES.HPM, ROLES.ADM] },
  { method: "DELETE", path: "/api/salary-rules/:id", roles: [ROLES.HPM, ROLES.ADM] },
  { method: "POST", path: "/api/salary-rules/preview", roles: [ROLES.HPM, ROLES.ADM] },
  // Payrun Batches (API.md §10) — HPU/HPM/ADM for core flow; HPM/ADM for state transitions
  { method: "POST", path: "/api/payruns", roles: [ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/payruns", roles: [ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/payruns/:id", roles: [ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/payruns/:id/warnings", roles: [ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "POST", path: "/api/payruns/:id/compute", roles: [ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "PATCH", path: "/api/payruns/:id", roles: [ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "DELETE", path: "/api/payruns/:id", roles: [ROLES.HPM, ROLES.ADM] },
  { method: "POST", path: "/api/payruns/:id/validate", roles: [ROLES.HPM, ROLES.ADM] },
  { method: "POST", path: "/api/payruns/:id/mark-paid", roles: [ROLES.HPM, ROLES.ADM] },
  { method: "POST", path: "/api/payruns/:id/close", roles: [ROLES.HPM, ROLES.ADM] },
  { method: "POST", path: "/api/payruns/:id/send", roles: [ROLES.HPM, ROLES.ADM] },
  // Payslips (API.md §11)
  { method: "GET", path: "/api/payslips", roles: [ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/payslips/:id", roles: [ROLES.HPU, ROLES.HPM, ROLES.ADM, ROLES.EMP] },
  { method: "PATCH", path: "/api/payslips/:id", roles: [ROLES.HPM, ROLES.ADM] },
  { method: "DELETE", path: "/api/payslips/:id", roles: [ROLES.ADM] },
  { method: "POST", path: "/api/payslips/:id/pdf", roles: [ROLES.HPU, ROLES.HPM, ROLES.ADM, ROLES.EMP] },
  { method: "POST", path: "/api/payslips/:id/send", roles: [ROLES.HPM, ROLES.ADM] },
  // Dashboard (API.md §12) — HPU/HPM/ADM; HRM gets a dept-scoped view via the UI (optional)
  { method: "GET", path: "/api/dashboard/kpis", roles: [ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/dashboard/trends/net-salary", roles: [ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/dashboard/department-cost", roles: [ROLES.HPU, ROLES.HPM, ROLES.ADM] },
  { method: "GET", path: "/api/dashboard/alerts", roles: [ROLES.HPU, ROLES.HPM, ROLES.ADM] },
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

// GET /api/employees/me — employee self profile (must be before :id).
// Includes their own working schedule + shifts + related counts so the employee
// home page is a single round-trip (self-service landing for the EMP role).
app.get("/api/employees/me", async (req, res) => {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: req.user.employeeId },
      include: {
        manager: { select: { id: true, name: true } },
        workingSchedule: { include: { shifts: true } },
        _count: { select: { contracts: true, attendances: true, requests: true, allocations: true } },
      },
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

// ---------- Attendance routes (API.md §4) ----------

function attendanceHours(checkIn, checkOut) {
  if (!checkOut) return null;
  return Math.max(0, (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 3600000);
}

function attendanceStatus(checkIn, checkOut, workedHours, schedule) {
  const dailyHours = Number(schedule?.totalWeeklyHours || 40) / 5;
  if (checkOut && workedHours > dailyHours + 0.01) return "OVERTIME";
  const day = new Date(checkIn).getDay();
  const shift = schedule?.shifts?.find((item) => item.dayOfWeek === (day === 0 ? 7 : day));
  if (shift) {
    const [hour, minute] = shift.startTime.split(":").map(Number);
    const expected = new Date(checkIn);
    expected.setHours(hour, minute, 0, 0);
    if (new Date(checkIn).getTime() > expected.getTime() + 15 * 60000) return "LATE";
  }
  return "PRESENT";
}

function isAttendanceOwner(req, attendance) {
  return req.user.role !== ROLES.EMP || req.user.employeeId === attendance.employeeId;
}

async function getAttendanceWithSchedule(id) {
  return prisma.attendance.findUnique({
    where: { id },
    include: { employee: { include: { workingSchedule: { include: { shifts: true } } } } },
  });
}

// POST /api/attendance/check-in — opens one attendance record for the logged-in employee.
app.post("/api/attendance/check-in", async (req, res) => {
  try {
    if (!req.user.employeeId) {
      return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "User is not linked to an employee" } });
    }
    const open = await prisma.attendance.findFirst({ where: { employeeId: req.user.employeeId, checkOut: null } });
    if (open) {
      return res.status(409).json({ data: null, error: { code: "ALREADY_CHECKED_IN", message: "You already have an open attendance record" } });
    }
    const employee = await prisma.employee.findUnique({
      where: { id: req.user.employeeId },
      include: { workingSchedule: { include: { shifts: true } } },
    });
    if (!employee) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Employee not found" } });
    const now = new Date();
    const attendance = await prisma.attendance.create({
      data: { employeeId: employee.id, checkIn: now, status: attendanceStatus(now, null, null, employee.workingSchedule) },
    });
    return res.status(201).json({ data: attendance });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// POST /api/attendance/:id/check-out — closes only the employee's own open record.
app.post("/api/attendance/:id/check-out", async (req, res) => {
  try {
    const attendance = await getAttendanceWithSchedule(req.params.id);
    if (!attendance) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Attendance record not found" } });
    if (!isAttendanceOwner(req, attendance)) return res.status(403).json({ data: null, error: { code: "FORBIDDEN", message: "Access denied" } });
    if (attendance.checkOut) return res.status(409).json({ data: null, error: { code: "ALREADY_CHECKED_OUT", message: "Attendance is already closed" } });
    const checkOut = new Date();
    const workedHours = attendanceHours(attendance.checkIn, checkOut);
    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: { checkOut, workedHours, status: attendanceStatus(attendance.checkIn, checkOut, workedHours, attendance.employee.workingSchedule) },
    });
    return res.json({ data: updated });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// GET /api/attendance — HR list with employee, status and date filters.
app.get("/api/attendance", async (req, res) => {
  try {
    const { employeeId, status, from, to } = req.query;
    const where = {
      ...(employeeId && { employeeId }),
      ...(status && { status }),
      ...((from || to) && { checkIn: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    };
    const attendance = await prisma.attendance.findMany({
      where,
      include: { employee: { select: { id: true, name: true, department: true } } },
      orderBy: { checkIn: "desc" },
    });
    return res.json({ data: attendance });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// GET /api/attendance/:id — HR or owning employee.
app.get("/api/attendance/:id", async (req, res) => {
  try {
    const attendance = await getAttendanceWithSchedule(req.params.id);
    if (!attendance) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Attendance record not found" } });
    if (!isAttendanceOwner(req, attendance)) return res.status(403).json({ data: null, error: { code: "FORBIDDEN", message: "Access denied" } });
    return res.json({ data: attendance });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// PATCH /api/attendance/:id — HR correction; recalculates hours and stamps the editor.
app.patch("/api/attendance/:id", async (req, res) => {
  try {
    const attendance = await getAttendanceWithSchedule(req.params.id);
    if (!attendance) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Attendance record not found" } });
    const checkIn = req.body.checkIn ? new Date(req.body.checkIn) : attendance.checkIn;
    const checkOut = req.body.checkOut === null ? null : req.body.checkOut ? new Date(req.body.checkOut) : attendance.checkOut;
    if (Number.isNaN(checkIn.getTime()) || (checkOut && Number.isNaN(checkOut.getTime())) || (checkOut && checkOut < checkIn)) {
      return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Check-out must be after check-in" } });
    }
    const workedHours = attendanceHours(checkIn, checkOut);
    const updated = await prisma.attendance.update({
      where: { id: attendance.id },
      data: {
        checkIn,
        checkOut,
        workedHours,
        status: req.body.status || attendanceStatus(checkIn, checkOut, workedHours, attendance.employee.workingSchedule),
        correctedBy: req.user.userId,
      },
    });
    return res.json({ data: updated });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// DELETE /api/attendance/:id — Admin-only hard delete.
app.delete("/api/attendance/:id", async (req, res) => {
  try {
    await prisma.attendance.delete({ where: { id: req.params.id } });
    return res.json({ data: { success: true } });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
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
        scheduleOverrideId: scheduleOverrideId || null,
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
        scheduleOverride: true,
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

    const { startDate, endDate, wage, department, position, salaryStructureId, scheduleOverrideId, status } = req.body;
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
        ...(scheduleOverrideId !== undefined && { scheduleOverrideId: scheduleOverrideId || null }),
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

// ---------- Time Off Allocations routes (API.md §6) ----------

const allocInclude = { employee: { select: { id: true, name: true } }, timeOffType: { select: { id: true, name: true, unit: true, tracksBalance: true, requiresApproval: true } } };

// POST /api/time-off/allocations — create (approvedByHR defaults to false)
app.post("/api/time-off/allocations", async (req, res) => {
  try {
    const { employeeId, timeOffTypeId, quota, validFrom, validTo } = req.body;
    const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
    const type = await prisma.timeOffType.findUnique({ where: { id: timeOffTypeId } });
    if (!employee || !type) return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Employee or time off type not found" } });
    if (quota == null || Number(quota) <= 0) return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Quota must be a positive number" } });
    const allocation = await prisma.timeOffAllocation.create({
      data: {
        employeeId,
        timeOffTypeId,
        quota,
        remaining: quota,
        validFrom: new Date(validFrom),
        validTo: validTo ? new Date(validTo) : null,
      },
      include: allocInclude,
    });
    return res.status(201).json({ data: allocation });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// GET /api/time-off/allocations — list (HR roles), filters
app.get("/api/time-off/allocations", async (req, res) => {
  try {
    const { employeeId, timeOffTypeId } = req.query;
    const allocations = await prisma.timeOffAllocation.findMany({
      where: { ...(employeeId && { employeeId }), ...(timeOffTypeId && { timeOffTypeId }) },
      include: allocInclude,
      orderBy: { validFrom: "desc" },
    });
    return res.json({ data: allocations });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// GET /api/time-off/allocations/:id — detail (EMP self-scoped)
app.get("/api/time-off/allocations/:id", async (req, res) => {
  try {
    const allocation = await prisma.timeOffAllocation.findUnique({ where: { id: req.params.id }, include: allocInclude });
    if (!allocation) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Allocation not found" } });
    if (req.user.role === ROLES.EMP && allocation.employeeId !== req.user.employeeId) {
      return res.status(403).json({ data: null, error: { code: "FORBIDDEN", message: "Access denied" } });
    }
    return res.json({ data: allocation });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// PATCH /api/time-off/allocations/:id — update (approve makes spendable)
app.patch("/api/time-off/allocations/:id", async (req, res) => {
  try {
    const { quota, validTo, approvedByHR } = req.body;
    const existing = await prisma.timeOffAllocation.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Allocation not found" } });
    const data = {};
    if (quota !== undefined) {
      const q = Number(quota);
      if (q <= 0) return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Quota must be a positive number" } });
      // Rebase remaining so adjustments keep the delta from old quota.
      data.quota = q;
      data.remaining = q - (Number(existing.quota) - Number(existing.remaining));
    }
    if (validTo !== undefined) data.validTo = validTo ? new Date(validTo) : null;
    if (approvedByHR !== undefined) data.approvedByHR = !!approvedByHR;
    const allocation = await prisma.timeOffAllocation.update({ where: { id: req.params.id }, data, include: allocInclude });
    return res.json({ data: allocation });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// DELETE /api/time-off/allocations/:id — Admin only
app.delete("/api/time-off/allocations/:id", async (req, res) => {
  try {
    await prisma.timeOffAllocation.delete({ where: { id: req.params.id } });
    return res.json({ data: { success: true } });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// ---------- Time Off Requests routes (API.md §7) ----------

const reqInclude = {
  employee: { select: { id: true, name: true, jobPosition: true, department: true } },
  timeOffType: { select: { id: true, name: true, unit: true, tracksBalance: true } },
  approvedBy: { select: { id: true, email: true, role: true } },
};

// Duration in the type's unit (DAYS → inclusive calendar days, HOURS → workday 8h) — shared by create + approve.
function requestDurationInUnit(startDate, endDate, type) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const days = Math.floor((end - start) / 86400000) + 1;
  if (type?.unit === "HOURS") return days * 8;
  return days;
}

// POST /api/time-off/requests — EMP self creates a PENDING request
app.post("/api/time-off/requests", async (req, res) => {
  try {
    const { timeOffTypeId, startDate, endDate, reason } = req.body;
    const type = await prisma.timeOffType.findUnique({ where: { id: timeOffTypeId } });
    if (!type) return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Time off type not found" } });
    if (!startDate || !endDate) return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "startDate and endDate are required" } });
    if (new Date(endDate) < new Date(startDate)) return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "endDate must be on or after startDate" } });
    const request = await prisma.timeOffRequest.create({
      data: {
        employeeId: req.user.employeeId,
        timeOffTypeId,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason: reason || null,
      },
      include: reqInclude,
    });
    return res.status(201).json({ data: request });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// GET /api/time-off/requests — HR approver queue, filters
app.get("/api/time-off/requests", async (req, res) => {
  try {
    const { status, employeeId } = req.query;
    const requests = await prisma.timeOffRequest.findMany({
      where: { ...(status && { status }), ...(employeeId && { employeeId }) },
      include: reqInclude,
      orderBy: { createdAt: "desc" },
    });
    return res.json({ data: requests });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// GET /api/time-off/requests/:id — detail (EMP self-scoped)
app.get("/api/time-off/requests/:id", async (req, res) => {
  try {
    const request = await prisma.timeOffRequest.findUnique({ where: { id: req.params.id }, include: reqInclude });
    if (!request) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Request not found" } });
    if (req.user.role === ROLES.EMP && request.employeeId !== req.user.employeeId) {
      return res.status(403).json({ data: null, error: { code: "FORBIDDEN", message: "Access denied" } });
    }
    return res.json({ data: request });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// PATCH /api/time-off/requests/:id — EMP self edits while PENDING
app.patch("/api/time-off/requests/:id", async (req, res) => {
  try {
    const existing = await prisma.timeOffRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Request not found" } });
    if (existing.employeeId !== req.user.employeeId) return res.status(403).json({ data: null, error: { code: "FORBIDDEN", message: "Access denied" } });
    if (existing.status !== "PENDING") return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Only pending requests can be edited" } });
    const { startDate, endDate, reason } = req.body;
    const request = await prisma.timeOffRequest.update({
      where: { id: req.params.id },
      data: {
        ...(startDate && { startDate: new Date(startDate) }),
        ...(endDate && { endDate: new Date(endDate) }),
        ...(reason !== undefined && { reason: reason || null }),
      },
      include: reqInclude,
    });
    return res.json({ data: request });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// DELETE /api/time-off/requests/:id — EMP self withdraws while PENDING
app.delete("/api/time-off/requests/:id", async (req, res) => {
  try {
    const existing = await prisma.timeOffRequest.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Request not found" } });
    if (existing.employeeId !== req.user.employeeId) return res.status(403).json({ data: null, error: { code: "FORBIDDEN", message: "Access denied" } });
    if (existing.status !== "PENDING") return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Only pending requests can be withdrawn" } });
    await prisma.timeOffRequest.delete({ where: { id: req.params.id } });
    return res.json({ data: { success: true } });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// POST /api/time-off/requests/:id/approve — HRM/ADM atomically decrements remaining balance.
// Accepts an optional `responseNote` reply from HR that is stored on the request
// and shown back to the employee (request.reason stays untouched — employee input).
app.post("/api/time-off/requests/:id/approve", async (req, res) => {
  try {
    const request = await prisma.timeOffRequest.findUnique({ where: { id: req.params.id }, include: { timeOffType: true } });
    if (!request) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Request not found" } });
    if (request.status !== "PENDING") return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Only pending requests can be approved" } });

    const { responseNote } = req.body;
    const decided = { status: "APPROVED", approvedById: req.user.userId, decidedAt: new Date(), ...(responseNote !== undefined ? { responseNote: responseNote || null } : {}) };
    const duration = requestDurationInUnit(request.startDate, request.endDate, request.timeOffType);

    if (request.timeOffType.tracksBalance) {
      const result = await prisma.$transaction(async (tx) => {
        const allocation = await tx.timeOffAllocation.findFirst({
          where: {
            employeeId: request.employeeId,
            timeOffTypeId: request.timeOffTypeId,
            approvedByHR: true,
            validFrom: { lte: request.startDate },
            OR: [{ validTo: null }, { validTo: { gte: request.endDate } }],
          },
          orderBy: { validFrom: "asc" },
        });
        if (!allocation || Number(allocation.remaining) < duration) {
          throw new Error("INSUFFICIENT_BALANCE");
        }
        const updatedAllocation = await tx.timeOffAllocation.update({
          where: { id: allocation.id },
          data: { remaining: Number(allocation.remaining) - duration },
        });
        const updatedRequest = await tx.timeOffRequest.update({
          where: { id: request.id },
          data: decided,
          include: reqInclude,
        });
        return { updatedRequest, updatedAllocation };
      });
      return res.json({ data: result });
    }

    // Non-balance type (e.g. unpaid): approve without touching allocations
    const updatedRequest = await prisma.timeOffRequest.update({
      where: { id: request.id },
      data: decided,
      include: reqInclude,
    });
    return res.json({ data: { updatedRequest, updatedAllocation: null } });
  } catch (e) {
    if (e.message === "INSUFFICIENT_BALANCE") {
      return res.status(400).json({ data: null, error: { code: "INSUFFICIENT_BALANCE", message: "Not enough remaining balance for this request" } });
    }
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// POST /api/time-off/requests/:id/refuse — HRM/ADM, no balance change.
// The HR reply goes into `responseNote` (shown back to the employee later). The
// employee's original request `reason` is preserved, not overwritten anymore.
app.post("/api/time-off/requests/:id/refuse", async (req, res) => {
  try {
    const request = await prisma.timeOffRequest.findUnique({ where: { id: req.params.id } });
    if (!request) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Request not found" } });
    if (request.status !== "PENDING") return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Only pending requests can be refused" } });
    const { responseNote } = req.body;
    const updatedRequest = await prisma.timeOffRequest.update({
      where: { id: request.id },
      data: { status: "REFUSED", ...(responseNote !== undefined ? { responseNote: responseNote || null } : {}), approvedById: req.user.userId, decidedAt: new Date() },
      include: reqInclude,
    });
    return res.json({ data: { updatedRequest, updatedAllocation: null } });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// ---------- Salary Structures & Rules (API.md §8–9) ----------

// Ascending-sequence validation: no other rule in the same structure may share this sequence.
async function assertUniqueSequence(excludeRuleId, salaryStructureId, sequence) {
  const clash = await prisma.salaryRule.findFirst({
    where: { salaryStructureId, sequence, ...(excludeRuleId ? { id: { not: excludeRuleId } } : {}) },
  });
  return !clash;
}

// Formula evaluator: resolves rule codes to computed amounts, then evaluates + - * / ( ) with precedence.
// Recursive-descent mini-parser — no eval(), no arbitrary code execution.
function evaluateFormula(formula, amounts) {
  const clean = (formula || "").replace(/\s+/g, "");
  const tokens = clean.match(/[A-Za-z_][A-Za-z_0-9]*|\d+(?:\.\d+)?|[+\-*/()]/g) || [];
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function factor() {
    const t = next();
    if (t === "(") {
      const v = expr();
      next(); // consume ')'
      return v;
    }
    if (t === "-") return -factor();
    if (!isNaN(Number(t))) return Number(t);
    return Number(amounts[t] ?? 0); // rule code reference
  }
  function term() {
    let v = factor();
    while (peek() === "*" || peek() === "/") {
      const op = next();
      const r = factor();
      v = op === "*" ? v * r : r === 0 ? 0 : v / r;
    }
    return v;
  }
  function expr() {
    let v = term();
    while (peek() === "+" || peek() === "-") {
      const op = next();
      const r = term();
      v = op === "+" ? v + r : v - r;
    }
    return v;
  }
  const result = expr();
  if (tokens.length && !Number.isFinite(result)) return 0;
  return Number.isFinite(result) ? result : 0;
}

// computePayslip(): pure deterministic rule engine (TASKS.md Step 8 guardrail — reused by the Payrun engine).
// Runs rules in ascending sequence, memoizing by code so later rules can reference earlier ones.
// Each line also carries an `explanation` string so formula execution is visible in the UI (preview).
function computePayslip(rules, { wage = 0 } = {}) {
  const amounts = {};
  const lines = [];
  const fmt = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
  for (const rule of [...rules].sort((a, b) => a.sequence - b.sequence)) {
    let amount = 0;
    let explanation = "";
    switch (rule.calculationType) {
      case "FIXED":
        amount = rule.value != null ? Number(rule.value) : Number(wage) || 0;
        explanation = rule.value != null ? `Fixed amount ${fmt(amount)}` : `Taken from contract wage ${fmt(amount)}`;
        break;
      case "PERCENTAGE":
        amount = (amounts[rule.baseRuleCode] ?? 0) * (Number(rule.value) || 0) / 100;
        explanation = `${rule.value}% of ${rule.baseRuleCode} (${fmt(amounts[rule.baseRuleCode] ?? 0)}) = ${fmt(amount)}`;
        break;
      case "FORMULA":
        amount = evaluateFormula(rule.formula, amounts);
        explanation = `${rule.formula || "—"} = ${fmt(amount)}`;
        break;
      default:
        amount = 0;
    }
    amounts[rule.code] = amount;
    lines.push({
      ...(rule.id && { salaryRuleId: rule.id }),
      sequence: rule.sequence,
      category: rule.category,
      name: rule.name,
      code: rule.code,
      amount,
      explanation,
    });
  }
  return { lines, amounts };
}

// POST /api/salary-structures — create (HPM/ADM)
app.post("/api/salary-structures", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Name is required" } });
    const structure = await prisma.salaryStructure.create({ data: { name } });
    return res.status(201).json({ data: structure });
  } catch (e) {
    if (e.code === "P2002") return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "A structure with that name already exists" } });
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// GET /api/salary-structures — list (read-only for HRM/HPU)
app.get("/api/salary-structures", async (_req, res) => {
  try {
    const structures = await prisma.salaryStructure.findMany({
      include: { _count: { select: { rules: true, contracts: true } } },
      orderBy: { name: "asc" },
    });
    return res.json({ data: structures });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// GET /api/salary-structures/:id — detail with rules
app.get("/api/salary-structures/:id", async (req, res) => {
  try {
    const structure = await prisma.salaryStructure.findUnique({
      where: { id: req.params.id },
      include: { rules: { orderBy: { sequence: "asc" } } },
    });
    if (!structure) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Structure not found" } });
    return res.json({ data: structure });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// PATCH /api/salary-structures/:id — rename
app.patch("/api/salary-structures/:id", async (req, res) => {
  try {
    const structure = await prisma.salaryStructure.update({ where: { id: req.params.id }, data: { name: req.body.name } });
    return res.json({ data: structure });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// DELETE /api/salary-structures/:id — Admin only, blocked if used by any Contract
app.delete("/api/salary-structures/:id", async (req, res) => {
  try {
    const used = await prisma.contract.count({ where: { salaryStructureId: req.params.id } });
    if (used > 0) return res.status(400).json({ data: null, error: { code: "CANNOT_DELETE", message: "Structure is used by a contract" } });
    await prisma.salaryStructure.delete({ where: { id: req.params.id } });
    return res.json({ data: { success: true } });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// POST /api/salary-rules — create (HPM/ADM), validates ascending unique sequence
app.post("/api/salary-rules", async (req, res) => {
  try {
    const { salaryStructureId, name, code, category, sequence, calculationType, value, formula, baseRuleCode } = req.body;
    if (!salaryStructureId || !name || !code || !category || !sequence || !calculationType) {
      return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Missing required fields" } });
    }
    const okSeq = await assertUniqueSequence(null, salaryStructureId, Number(sequence));
    if (!okSeq) return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Sequence number already in use in this structure" } });
    const rule = await prisma.salaryRule.create({
      data: { salaryStructureId, name, code, category, sequence: Number(sequence), calculationType, value: value != null ? Number(value) : null, formula: formula || null, baseRuleCode: baseRuleCode || null },
      include: { salaryStructure: true },
    });
    return res.status(201).json({ data: rule });
  } catch (e) {
    if (e.code === "P2002") return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "A rule with that code already exists in this structure" } });
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// GET /api/salary-rules — list, ordered by sequence (?salaryStructureId=)
app.get("/api/salary-rules", async (req, res) => {
  try {
    const { salaryStructureId } = req.query;
    const rules = await prisma.salaryRule.findMany({
      where: { ...(salaryStructureId && { salaryStructureId }) },
      include: { salaryStructure: { select: { id: true, name: true } } },
      orderBy: [{ salaryStructureId: "asc" }, { sequence: "asc" }],
    });
    return res.json({ data: rules });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// POST /api/salary-rules/preview — dry-run the rule engine (must precede /:id in Express)
app.post("/api/salary-rules/preview", async (req, res) => {
  try {
    const { salaryStructureId, employeeId, periodStart, periodEnd } = req.body;
    const structure = await prisma.salaryStructure.findUnique({
      where: { id: salaryStructureId },
      include: { rules: { orderBy: { sequence: "asc" } } },
    });
    if (!structure) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Structure not found" } });
    const contract = await getActiveContract(employeeId, periodStart ? new Date(periodStart) : new Date());
    if (!contract) return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Employee has no active contract" } });
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true, name: true } });
    const { lines, amounts } = computePayslip(structure.rules, { wage: Number(contract.wage) });
    const gross = lines.filter((l) => l.category === "ALLOWANCE" || l.category === "BASIC").reduce((s, l) => s + l.amount, 0);
    const deductions = lines.filter((l) => l.category === "DEDUCTION").reduce((s, l) => s + l.amount, 0);
    return res.json({ data: { structure: { id: structure.id, name: structure.name }, employee: { id: contract.employeeId, name: employee?.name || null }, contract: { id: contract.id, wage: Number(contract.wage) }, lines, gross, deductions, totals: amounts } });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// GET /api/salary-rules/:id — detail
app.get("/api/salary-rules/:id", async (req, res) => {
  try {
    const rule = await prisma.salaryRule.findUnique({ where: { id: req.params.id }, include: { salaryStructure: { select: { id: true, name: true } } } });
    if (!rule) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Rule not found" } });
    return res.json({ data: rule });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// PATCH /api/salary-rules/:id — update (re-validates sequence ordering)
app.patch("/api/salary-rules/:id", async (req, res) => {
  try {
    const { name, code, category, sequence, calculationType, value, formula, baseRuleCode } = req.body;
    const existing = await prisma.salaryRule.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Rule not found" } });
    if (sequence !== undefined) {
      const okSeq = await assertUniqueSequence(req.params.id, existing.salaryStructureId, Number(sequence));
      if (!okSeq) return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Sequence number already in use in this structure" } });
    }
    const rule = await prisma.salaryRule.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(code !== undefined && { code }),
        ...(category !== undefined && { category }),
        ...(sequence !== undefined && { sequence: Number(sequence) }),
        ...(calculationType !== undefined && { calculationType }),
        ...(value !== undefined && { value: value != null ? Number(value) : null }),
        ...(formula !== undefined && { formula: formula || null }),
        ...(baseRuleCode !== undefined && { baseRuleCode: baseRuleCode || null }),
      },
      include: { salaryStructure: { select: { id: true, name: true } } },
    });
    return res.json({ data: rule });
  } catch (e) {
    if (e.code === "P2002") return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "A rule with that code already exists in this structure" } });
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// DELETE /api/salary-rules/:id — HPM/ADM
app.delete("/api/salary-rules/:id", async (req, res) => {
  try {
    await prisma.salaryRule.delete({ where: { id: req.params.id } });
    return res.json({ data: { success: true } });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// ---------- Payrun Batch routes (API.md §10) ----------

// Shared Prisma include for a Payslip's employee + ordered lines.
const payslipInclude = {
  include: {
    employee: { select: { id: true, name: true, department: true, jobPosition: true } },
    lines: { orderBy: { sequence: "asc" } },
  },
};

// Validation Engine (API.md §10 — /warnings): surfaces operational issues per payrun,
// e.g. missing contract, missing bank info, duplicate payslip, unapproved leave.
async function buildPayrunWarnings(batch) {
  const warnings = [];
  const payslips = await prisma.payslip.findMany({ where: { payrunBatchId: batch.id }, include: { employee: true } });
  for (const p of payslips) {
    const issues = [];
    if (!p.contractId) issues.push("missing contract");
    const pendingLeave = await prisma.timeOffRequest.count({
      where: { employeeId: p.employeeId, status: "PENDING", startDate: { lte: batch.periodEnd }, endDate: { gte: batch.periodStart } },
    });
    if (pendingLeave > 0) issues.push(`${pendingLeave} unapproved leave request(s)`);
    issues.forEach((issue) =>
      warnings.push({ type: "PAYSLIP", message: `${p.employee?.name || p.employeeId}: ${issue}`, payslipId: p.id })
    );
  }
  // Duplicate payslip guard: two ACTIVE contracts overlapping the period for the same employee
  for (const p of payslips) {
    if (!p.contractId) continue;
    const dup = await prisma.contract.count({
      where: {
        employeeId: p.employeeId,
        status: "ACTIVE",
        id: { not: p.contractId },
        startDate: { lte: batch.periodEnd },
        OR: [{ endDate: null }, { endDate: { gte: batch.periodStart } }],
      },
    });
    if (dup > 0) warnings.push({ type: "DUPLICATE_CONTRACT", message: `${p.employee?.name}: overlapping ACTIVE contracts in period`, payslipId: p.id });
  }
  return warnings;
}

// POST /api/payruns — create a DRAFT batch (Wizard Step 1 + 2 combined submit)
app.post("/api/payruns", async (req, res) => {
  try {
    const { periodStart, periodEnd, salaryStructureId, employeeIds } = req.body;
    if (!periodStart || !periodEnd || !salaryStructureId) {
      return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "periodStart, periodEnd and salaryStructureId are required" } });
    }
    const structure = await prisma.salaryStructure.findUnique({ where: { id: salaryStructureId } });
    if (!structure) return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Salary structure not found" } });
    const batch = await prisma.payrunBatch.create({
      data: {
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        salaryStructureId,
        state: "DRAFT",
      },
    });
    // Store selected employees via pre-created (but un-computed) payslip stubs so the
    // batch detail can show who's included before Compute runs.
    if (Array.isArray(employeeIds) && employeeIds.length) {
      const employees = await prisma.employee.findMany({ where: { id: { in: employeeIds } } });
      await prisma.payslip.createMany({
        data: employees.map((e) => ({
          payrunBatchId: batch.id,
          employeeId: e.id,
          contractId: null, // filled on compute
          grossTotal: 0,
          deductionTotal: 0,
          netTotal: 0,
        })),
      });
    }
    const full = await prisma.payrunBatch.findUnique({
      where: { id: batch.id },
      include: { payslips: { include: { employee: { select: { id: true, name: true } } } } },
    });
    return res.status(201).json({ data: full });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// GET /api/payruns — list with filters, plus payrun + payslip counts
app.get("/api/payruns", async (req, res) => {
  try {
    const { state } = req.query;
    const batches = await prisma.payrunBatch.findMany({
      where: { ...(state && { state }) },
      include: {
        salaryStructure: { select: { id: true, name: true } },
        _count: { select: { payslips: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    // attach netTotal sum per batch for a quick glance
    const result = await Promise.all(batches.map(async (b) => {
      const sum = await prisma.payslip.aggregate({ where: { payrunBatchId: b.id }, _sum: { netTotal: true } });
      return { ...b, netSum: Number(sum._sum.netTotal || 0) };
    }));
    return res.json({ data: result });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// GET /api/payruns/:id — detail with payslip summaries
app.get("/api/payruns/:id", async (req, res) => {
  try {
    const batch = await prisma.payrunBatch.findUnique({
      where: { id: req.params.id },
      include: { salaryStructure: true, payslips: payslipInclude },
    });
    if (!batch) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Payrun not found" } });
    return res.json({ data: batch });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// GET /api/payruns/:id/warnings — Validation Engine output
app.get("/api/payruns/:id/warnings", async (req, res) => {
  try {
    const batch = await prisma.payrunBatch.findUnique({ where: { id: req.params.id } });
    if (!batch) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Payrun not found" } });
    const warnings = await buildPayrunWarnings(batch);
    return res.json({ data: warnings });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// POST /api/payruns/:id/compute — resolve active contracts, run rule engine, persist payslips.
// Idempotent while DRAFT: re-running recomputes the same payslips.
app.post("/api/payruns/:id/compute", async (req, res) => {
  try {
    const batch = await prisma.payrunBatch.findUnique({
      where: { id: req.params.id },
      include: { salaryStructure: { include: { rules: { orderBy: { sequence: "asc" } } } } },
    });
    if (!batch) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Payrun not found" } });
    if (batch.state !== "DRAFT" && batch.state !== "COMPUTED") {
      return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Can only compute a DRAFT or COMPUTED payrun" } });
    }

    const stubs = await prisma.payslip.findMany({
      where: { payrunBatchId: batch.id },
      include: { employee: { select: { id: true, name: true } } },
    });

    // Determine employees to compute: any stubs already associated, else none.
    // If no stubs exist (batch created without employees), we cannot infer; require stubs.
    if (!stubs.length) {
      return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "No employees selected for this payrun" } });
    }

    const periodStart = batch.periodStart;
    const periodEnd = batch.periodEnd;

    const results = await prisma.$transaction(async (tx) => {
      let generated = 0;
      for (const stub of stubs) {
        const contract = await tx.contract.findFirst({
          where: {
            employeeId: stub.employeeId,
            status: "ACTIVE",
            startDate: { lte: periodStart },
            OR: [{ endDate: null }, { endDate: { gte: periodEnd } }],
          },
          orderBy: { startDate: "desc" },
        });
        // If no active contract, keep the stub (contractId null, zero totals) so the
        // Validation Engine can surface a "missing contract" warning.
        if (!contract) {
          await tx.payslipLine.deleteMany({ where: { payslipId: stub.id } });
          await tx.payslip.update({
            where: { id: stub.id },
            data: { contractId: null, grossTotal: 0, deductionTotal: 0, netTotal: 0 },
          });
          continue;
        }
        const { lines, amounts } = computePayslip(batch.salaryStructure.rules, { wage: Number(contract.wage) });
        const gross = lines.filter((l) => l.category === "BASIC" || l.category === "ALLOWANCE").reduce((s, l) => s + l.amount, 0);
        const deductions = lines.filter((l) => l.category === "DEDUCTION").reduce((s, l) => s + l.amount, 0);
        const net = Number(amounts.NET ?? (gross - deductions));
        // Replace existing lines (idempotent recompute).
        await tx.payslipLine.deleteMany({ where: { payslipId: stub.id } });
        const payslip = await tx.payslip.update({
          where: { id: stub.id },
          data: {
            contractId: contract.id,
            grossTotal: gross,
            deductionTotal: deductions,
            netTotal: net,
          },
        });
        await tx.payslipLine.createMany({
          data: lines.map((l) => ({
            payslipId: payslip.id,
            salaryRuleId: l.salaryRuleId,
            sequence: l.sequence,
            category: l.category,
            amount: l.amount,
          })),
        });
        generated++;
      }
      const updated = await tx.payrunBatch.update({
        where: { id: batch.id },
        data: { state: "COMPUTED", computedAt: new Date() },
      });
      return { generated, updated };
    });

    const full = await prisma.payrunBatch.findUnique({
      where: { id: batch.id },
      include: { salaryStructure: true, payslips: payslipInclude },
    });
    return res.json({ data: { batch: full, generated: results.generated } });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// PATCH /api/payruns/:id — update period/employees while DRAFT
app.patch("/api/payruns/:id", async (req, res) => {
  try {
    const batch = await prisma.payrunBatch.findUnique({ where: { id: req.params.id } });
    if (!batch) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Payrun not found" } });
    if (batch.state !== "DRAFT") return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Only a DRAFT payrun can be scoped" } });
    const data = {};
    if (req.body.periodStart) data.periodStart = new Date(req.body.periodStart);
    if (req.body.periodEnd) data.periodEnd = new Date(req.body.periodEnd);
    const updated = await prisma.payrunBatch.update({ where: { id: req.params.id }, data });
    if (Array.isArray(req.body.employeeIds)) {
      // replace stub set while DRAFT (before compute)
      await prisma.payslip.deleteMany({ where: { payrunBatchId: batch.id } });
      if (req.body.employeeIds.length) {
        await prisma.payslip.createMany({
          data: req.body.employeeIds.map((id) => ({
            payrunBatchId: batch.id,
            employeeId: id,
            contractId: null,
            grossTotal: 0,
            deductionTotal: 0,
            netTotal: 0,
          })),
        });
      }
    }
    const full = await prisma.payrunBatch.findUnique({ where: { id: batch.id }, include: { payslips: { include: { employee: { select: { id: true, name: true } } } } } });
    return res.json({ data: full });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// DELETE /api/payruns/:id — HPM/ADM, only while DRAFT
app.delete("/api/payruns/:id", async (req, res) => {
  try {
    const batch = await prisma.payrunBatch.findUnique({ where: { id: req.params.id } });
    if (!batch) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Payrun not found" } });
    if (batch.state !== "DRAFT") return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Only a DRAFT payrun can be deleted" } });
    await prisma.payslipLine.deleteMany({ where: { payslip: { payrunBatchId: batch.id } } });
    await prisma.payslip.deleteMany({ where: { payrunBatchId: batch.id } });
    await prisma.payrunBatch.delete({ where: { id: batch.id } });
    return res.json({ data: { success: true } });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// POST /api/payruns/:id/validate — HPM/ADM, blocked if unresolved warnings exist
app.post("/api/payruns/:id/validate", async (req, res) => {
  try {
    const batch = await prisma.payrunBatch.findUnique({ where: { id: req.params.id } });
    if (!batch) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Payrun not found" } });
    if (batch.state !== "COMPUTED") return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Only a COMPUTED payrun can be validated" } });
    const warnings = await buildPayrunWarnings(batch);
    if (warnings.length) {
      return res.status(400).json({ data: null, error: { code: "UNRESOLVED_WARNINGS", message: `Resolve ${warnings.length} warning(s) before validating`, warnings } });
    }
    const updated = await prisma.payrunBatch.update({ where: { id: batch.id }, data: { state: "VALIDATED", validatedAt: new Date() } });
    return res.json({ data: updated });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// POST /api/payruns/:id/mark-paid — HPM/ADM, locks batch + child payslips
app.post("/api/payruns/:id/mark-paid", async (req, res) => {
  try {
    const batch = await prisma.payrunBatch.findUnique({ where: { id: req.params.id } });
    if (!batch) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Payrun not found" } });
    if (batch.state !== "VALIDATED") return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Only a VALIDATED payrun can be marked paid" } });
    const updated = await prisma.$transaction(async (tx) => {
      await tx.payrunBatch.update({ where: { id: batch.id }, data: { state: "PAID", paidAt: new Date() } });
      // Lock: once PAID, payslips are read-only (enforced in API.md §11 PATCH guard)
      return tx.payrunBatch.findUnique({ where: { id: batch.id }, include: { salaryStructure: true, payslips: payslipInclude } });
    });
    return res.json({ data: updated });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// POST /api/payruns/:id/close — final state after send
app.post("/api/payruns/:id/close", async (req, res) => {
  try {
    const batch = await prisma.payrunBatch.findUnique({ where: { id: req.params.id } });
    if (!batch) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Payrun not found" } });
    if (batch.state !== "PAID") return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Only a PAID payrun can be closed" } });
    const updated = await prisma.payrunBatch.update({ where: { id: batch.id }, data: { state: "CLOSED" } });
    return res.json({ data: updated });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// POST /api/payruns/:id/send — simulated bulk dispatch (marks deliveryStatus)
app.post("/api/payruns/:id/send", async (req, res) => {
  try {
    const batch = await prisma.payrunBatch.findUnique({ where: { id: req.params.id } });
    if (!batch) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Payrun not found" } });
    if (batch.state !== "PAID") return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: "Only a PAID payrun can be sent" } });
    const payslips = await prisma.payslip.findMany({ where: { payrunBatchId: batch.id } });
    let dispatched = 0;
    let failed = 0;
    for (const p of payslips) {
      const ok = Math.random() > 0.05; // ~5% simulated failure rate
      await prisma.payslip.update({ where: { id: p.id }, data: { deliveryStatus: ok ? "SENT" : "FAILED" } });
      if (ok) dispatched++; else failed++;
    }
    return res.json({ data: { dispatched, failed } });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// ---------- Payslip routes (API.md §11) ----------

// GET /api/payslips — list (HPU/HPM/ADM) with filters
app.get("/api/payslips", async (req, res) => {
  try {
    const { payrunBatchId, employeeId } = req.query;
    const payslips = await prisma.payslip.findMany({
      where: { ...(payrunBatchId && { payrunBatchId }), ...(employeeId && { employeeId }) },
      include: { employee: { select: { id: true, name: true, department: true } } },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ data: payslips });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// GET /api/payslips/:id — detail (EMP sees own only)
app.get("/api/payslips/:id", async (req, res) => {
  try {
    const payslip = await prisma.payslip.findUnique({ where: { id: req.params.id }, include: payslipInclude.include });
    if (!payslip) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Payslip not found" } });
    if (req.user.role === ROLES.EMP && payslip.employeeId !== req.user.employeeId) {
      return res.status(403).json({ data: null, error: { code: "FORBIDDEN", message: "Access denied" } });
    }
    return res.json({ data: payslip });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// PATCH /api/payslips/:id — HPM/ADM, limited, blocked if batch PAID (locked)
app.patch("/api/payslips/:id", async (req, res) => {
  try {
    const payslip = await prisma.payslip.findUnique({ where: { id: req.params.id }, include: { payrunBatch: true } });
    if (!payslip) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Payslip not found" } });
    if (payslip.payrunBatch.state === "PAID" || payslip.payrunBatch.state === "CLOSED") {
      return res.status(400).json({ data: null, error: { code: "LOCKED", message: "Payslip is locked after the batch is paid" } });
    }
    const { deliveryStatus } = req.body;
    const updated = await prisma.payslip.update({
      where: { id: payslip.id },
      data: { ...(deliveryStatus && { deliveryStatus }) },
      include: payslipInclude.include,
    });
    return res.json({ data: updated });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// DELETE /api/payslips/:id — ADM, blocked if batch PAID
app.delete("/api/payslips/:id", async (req, res) => {
  try {
    const payslip = await prisma.payslip.findUnique({ where: { id: req.params.id }, include: { payrunBatch: true } });
    if (!payslip) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Payslip not found" } });
    if (payslip.payrunBatch.state === "PAID" || payslip.payrunBatch.state === "CLOSED") {
      return res.status(400).json({ data: null, error: { code: "LOCKED", message: "Payslip is locked after the batch is paid" } });
    }
    await prisma.payslipLine.deleteMany({ where: { payslipId: payslip.id } });
    await prisma.payslip.delete({ where: { id: payslip.id } });
    return res.json({ data: { success: true } });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// ---------- Payslip PDF + delivery (API.md §11, TASKS.md Step 11) ----------

// Escape a PDF string literal (parentheses/backslashes) and collapse non-ASCII
// punctuation (·, arrow, dashes) into clean ASCII so the base-14 font embeds safely.
function pdfEscape(s) {
  return String(s ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/[·•]/g, "-")
    .replace(/[→⇒]/g, "->")
    .replace(/[—–]/g, "-")
    .replace(/[\\()]/g, (ch) => "\\" + ch)
    .replace(/[^\x20-\x7E]/g, "?");
}

// Approximate Helvetica glyph advance (thousandths of em) per character class.
function charW(ch) {
  if (ch === " ") return 278;
  if ("0123456789.".includes(ch)) return 556;
  if (".,:;()[]/".includes(ch)) return 278;
  return 500;
}

function textW(str, size) {
  let u = 0;
  for (const ch of String(str)) u += charW(ch);
  return (u * size) / 1000;
}

// Minimal dependency-free single-page PDF builder (base-14 Helvetica), so no package is added.
function buildPayslipPdf(payslip) {
  const emp = payslip.employee || {};
  const batch = payslip.payrunBatch || {};
  const structure = batch.salaryStructure || {};
  const lines = payslip.lines || [];
  const money = (n) => Number(n || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

  const W = 612;
  const H = 792;
  const ML = 48; // page margin (equal both sides → centered block)
  const RIGHT = W - ML;
  const COLW = 380; // centered money column width
  const COX = (W - COLW) / 2; // column left edge
  const COR = COX + COLW; // column right edge (all amounts align here)
  const ops = [];

  // One text line: left, right, or horizontally centered on the page.
  const line = (y, t, { size = 11, x = ML, bold = false, right = false, center = false, color = "0 0 0" } = {}) => {
    let tx;
    if (center) tx = (W - textW(t, size)) / 2;
    else if (right) tx = COR - textW(t, size);
    else tx = x;
    ops.push(`BT /${bold ? "F2" : "F1"} ${size} Tf ${color} rg 1 0 0 1 ${tx.toFixed(2)} ${y.toFixed(2)} Tm (${pdfEscape(t)}) Tj ET`);
  };

  // Money slab: centered-column band with one text line vertically centered inside it.
  const slab = (bottom, height, t, { size = 11, bold = false, right = false, color = "0 0 0", bg = "0.96 0.95 0.93" } = {}) => {
    ops.push(`${bg} rg ${COX} ${bottom} ${COLW} ${height} re f`);
    line(bottom + (height - size) / 2 + size * 0.25, t, { size, bold, right, color });
  };

  // Thin centered rule.
  const rule = (y) => ops.push(`0.88 0.88 0.88 rg ${COX} ${y} ${COLW} 0.8 re f`);

  // Header: full-width purple band, brand + centered title.
  ops.push(`0.443 0.294 0.404 rg ${ML} ${H - 92} ${W - ML * 2} 54 re f`);
  line(H - 46, "PeoplePay360", { size: 9, center: true, color: "0.78 0.74 0.76" });
  line(H - 66, "PAYSLIP", { size: 18, bold: true, center: true, color: "1 1 1" });

  // Employee block (centered).
  line(678, emp.name || "-", { size: 15, bold: true, center: true });
  line(660, `${emp.jobPosition || ""} · ${emp.department || ""}`, { size: 10, center: true, color: "0.35 0.35 0.35" });
  rule(646);

  // Pay-run block: centered label + centered dates, muted structure/id beneath.
  line(628, "PAY RUN", { size: 9, bold: true, center: true, color: "0.45 0.45 0.45" });
  line(610, `${fmtDate(batch.periodStart)}  →  ${fmtDate(batch.periodEnd)}`, { size: 12 });
  line(593, `Structure: ${structure.name || "-"}`, { size: 9, center: true, color: "0.4 0.4 0.4" });
  line(580, `Payrun ID: ${batch.id || "-"}`, { size: 9, center: true, color: "0.4 0.4 0.4" });
  rule(566);

  // Breakdown: centered section label, rows inside the centered money column.
  line(548, "BREAKDOWN", { size: 9, bold: true, center: true, color: "0.45 0.45 0.45" });
  let y = 528;
  for (const l of lines) {
    line(y, `${l.category}  ·  ${l.salaryRule?.name || l.salaryRule?.code}`, { size: 10.5, x: COX + 8 });
    line(y, money(l.amount), { size: 10.5, right: true });
    y -= 16;
  }

  // Totals: tall slabs with clear gaps so Gross / Deductions / Net never overlap.
  slab(444, 30, "Gross Salary", { bold: true });
  slab(444, 30, money(payslip.grossTotal), { bold: true, right: true });
  slab(405, 30, "Total Deductions", { bold: true });
  slab(405, 30, money(payslip.deductionTotal), { bold: true, right: true });
  slab(360, 36, "Net Pay", { size: 14, bold: true, color: "1 1 1", bg: "0.443 0.294 0.404" });
  slab(360, 36, money(payslip.netTotal), { size: 14, bold: true, right: true, color: "1 1 1", bg: "0.443 0.294 0.404" });

  // Footer (centered).
  line(54, `Generated ${new Date().toLocaleString("en-IN")}`, { size: 8, center: true, color: "0.55 0.55 0.55" });
  line(40, "This is a system-generated payslip. All amounts are in INR and subject to final validation.", { size: 8, center: true, color: "0.55 0.55 0.55" });

  // Content stream + PDF object graph with byte-accurate offsets.
  const streamData = ops.join("\n");
  let pdf = "%PDF-1.4\n";
  const offsets = [0]; // index 0 = free-object entry; offsets[i] = byte offset of object i
  const addObj = (body) => {
    const repr = `${offsets.length} 0 obj\n${body}\nendobj\n`;
    offsets.push(Buffer.byteLength(pdf, "binary"));
    pdf += repr;
  };
  addObj(`<< /Type /Catalog /Pages 2 0 R >>\n`);
  addObj(`<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n`);
  addObj(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\n`);
  addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n`);
  addObj(`<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\n`);
  addObj(`<< /Length ${Buffer.byteLength(streamData, "binary")} >>\nstream\n${streamData}\nendstream\n`);

  const xrefStart = Buffer.byteLength(pdf, "binary");
  pdf += `xref\n0 ${offsets.length}\n`;
  for (let i = 0; i < offsets.length; i++) {
    pdf += i === 0 ? `0000000000 65535 f \n` : `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }
  pdf += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf, "binary");
}

// POST /api/payslips/:id/pdf — generate + serve the payslip PDF (EMP sees own only).
app.post("/api/payslips/:id/pdf", async (req, res) => {
  try {
    const payslip = await prisma.payslip.findUnique({
      where: { id: req.params.id },
      include: {
        employee: true,
        lines: { orderBy: { sequence: "asc" }, include: { salaryRule: true } },
        payrunBatch: { include: { salaryStructure: true } },
      },
    });
    if (!payslip) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Payslip not found" } });
    if (req.user.role === ROLES.EMP && payslip.employeeId !== req.user.employeeId) {
      return res.status(403).json({ data: null, error: { code: "FORBIDDEN", message: "Access denied" } });
    }
    const buf = buildPayslipPdf(payslip);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="payslip-${payslip.id}.pdf"`);
    return res.send(buf);
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// POST /api/payslips/:id/send — single-payslip resend (simulated dispatch).
app.post("/api/payslips/:id/send", async (req, res) => {
  try {
    const payslip = await prisma.payslip.findUnique({ where: { id: req.params.id } });
    if (!payslip) return res.status(404).json({ data: null, error: { code: "NOT_FOUND", message: "Payslip not found" } });
    const ok = Math.random() > 0.05; // ~5% simulated failure rate
    const updated = await prisma.payslip.update({
      where: { id: payslip.id },
      data: { deliveryStatus: ok ? "SENT" : "FAILED" },
      include: payslipInclude.include,
    });
    return res.json({ data: updated });
  } catch (e) {
    return res.status(400).json({ data: null, error: { code: "BAD_REQUEST", message: e.message } });
  }
});

// ---------- Dashboard routes (API.md §12) ----------
// All KPIs are computed on every request against the live tables — never cached/static.

function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Does a batch period intersect the optional [start, end] window?
function inPeriod(periodStart, periodEnd, start, end) {
  const ps = new Date(periodStart).getTime();
  const pe = new Date(periodEnd).getTime();
  const s = start ? new Date(start).getTime() : null;
  const e = end ? new Date(end).getTime() : null;
  if (s !== null && pe < s) return false;
  if (e !== null && ps > e) return false;
  return true;
}

// Resolves department / employment-type filters into an allowed employee-id set.
// employmentType is matched against the employee's ACTIVE contract salary structure name.
async function dashboardEmployeeScope(department, employmentType) {
  const where = department && department !== "all" ? { department } : {};
  const employees = await prisma.employee.findMany({
    where,
    include: { contracts: { include: { salaryStructure: true } } },
  });
  if (!employmentType || employmentType === "all") return employees.map((e) => e.id);
  const ids = [];
  for (const e of employees) {
    const active = e.contracts.find((c) => c.status === "ACTIVE");
    const type = active?.salaryStructure?.name?.toLowerCase() || "";
    if (type.includes(employmentType.toLowerCase())) ids.push(e.id);
  }
  return ids;
}

// GET /api/dashboard/kpis — headline payroll metrics with optional filters
app.get("/api/dashboard/kpis", async (req, res) => {
  try {
    const { periodStart, periodEnd, department, employmentType } = req.query;
    const scope = await dashboardEmployeeScope(department, employmentType);
    const payslips = await prisma.payslip.findMany({
      include: { payrunBatch: true, employee: true },
    });
    const windowed = payslips.filter(
      (p) => scope.includes(p.employeeId) && inPeriod(p.payrunBatch.periodStart, p.payrunBatch.periodEnd, periodStart, periodEnd)
    );
    const paid = windowed.filter((p) => ["PAID", "CLOSED"].includes(p.payrunBatch.state));
    const totalNetPaid = Math.round(paid.reduce((s, p) => s + Number(p.netTotal || 0), 0) * 100) / 100;
    const averageSalary =
      windowed.length > 0
        ? Math.round((windowed.reduce((s, p) => s + Number(p.netTotal || 0), 0) / windowed.length) * 100) / 100
        : 0;

    // Approved time off (inclusive days), date-overlapping the window.
    const empById = {};
    for (const e of await prisma.employee.findMany({ select: { id: true, department: true } })) empById[e.id] = e;
    const requests = await prisma.timeOffRequest.findMany({
      where: { status: "APPROVED" },
      include: { employee: true },
    });
    let approvedTimeOffDays = 0;
    for (const r of requests) {
      if (!scope.includes(r.employeeId)) continue;
      const s = periodStart ? Math.max(new Date(r.startDate).getTime(), new Date(periodStart).getTime()) : new Date(r.startDate).getTime();
      const e = periodEnd ? Math.min(new Date(r.endDate).getTime(), new Date(periodEnd).getTime()) : new Date(r.endDate).getTime();
      if (e < s) continue;
      approvedTimeOffDays += Math.round((e - s) / 86400000) + 1;
    }

    // Attendance health: share of records that are not ABSENT within the window (default last 30 days).
    const attStart = periodStart ? new Date(periodStart) : new Date(Date.now() - 30 * 86400000);
    const attEnd = periodEnd ? new Date(periodEnd) : new Date();
    const attendances = await prisma.attendance.findMany({
      where: { checkIn: { gte: attStart, lte: attEnd } },
    });
    const scoped = attendances.filter((a) => scope.includes(a.employeeId));
    const attendanceHealthPct =
      scoped.length > 0 ? Math.round((scoped.filter((a) => a.status !== "ABSENT").length / scoped.length) * 100) : 0;

    return res.json({ data: { totalNetPaid, payslipsGenerated: windowed.length, averageSalary, approvedTimeOffDays, attendanceHealthPct } });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// GET /api/dashboard/trends/net-salary — monthly net total for the last N months (default 6)
app.get("/api/dashboard/trends/net-salary", async (req, res) => {
  try {
    const months = Math.min(Math.max(parseInt(req.query.months) || 6, 1), 24);
    const now = new Date();
    const buckets = {};
    const order = [];
    for (let i = months - 1; i >= 0; i--) {
      const key = monthKey(new Date(now.getFullYear(), now.getMonth() - i, 1));
      buckets[key] = { month: key, totalNet: 0 };
      order.push(key);
    }
    const payslips = await prisma.payslip.findMany({ include: { payrunBatch: true } });
    for (const p of payslips) {
      const key = monthKey(new Date(p.payrunBatch.periodStart));
      if (buckets[key]) buckets[key].totalNet += Number(p.netTotal || 0);
    }
    return res.json({ data: order.map((k) => ({ ...buckets[k], totalNet: Math.round(buckets[k].totalNet * 100) / 100 })) });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// GET /api/dashboard/department-cost — spend + headcount per department
app.get("/api/dashboard/department-cost", async (req, res) => {
  try {
    const { periodStart, periodEnd } = req.query;
    const payslips = await prisma.payslip.findMany({ include: { payrunBatch: true, employee: true } });
    const groups = {};
    for (const p of payslips) {
      if (!inPeriod(p.payrunBatch.periodStart, p.payrunBatch.periodEnd, periodStart, periodEnd)) continue;
      const d = p.employee?.department || "Unknown";
      if (!groups[d]) groups[d] = { department: d, headcount: new Set(), totalSpend: 0 };
      groups[d].headcount.add(p.employeeId);
      groups[d].totalSpend += Number(p.netTotal || 0);
    }
    const data = Object.values(groups)
      .map((g) => ({ department: g.department, headcount: g.headcount.size, totalSpend: Math.round(g.totalSpend * 100) / 100 }))
      .sort((a, b) => b.totalSpend - a.totalSpend);
    return res.json({ data });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

// GET /api/dashboard/alerts — operational feed from live tables
app.get("/api/dashboard/alerts", async (req, res) => {
  try {
    const alerts = [];
    const now = new Date();
    const in60 = new Date(now.getTime() + 60 * 86400000);
    const employees = await prisma.employee.findMany({
      include: { contracts: true, attendances: true },
    });

    for (const e of employees) {
      const active = e.contracts.find((c) => c.status === "ACTIVE");
      if (!active) {
        alerts.push({ type: "CONTRACT", severity: "high", message: `${e.name} has no active contract` });
        continue;
      }
      if (active.endDate && new Date(active.endDate).getTime() < now.getTime()) {
        alerts.push({ type: "EXPIRING", severity: "high", message: `${e.name}'s contract expired on ${active.endDate.toISOString().slice(0, 10)}` });
      } else if (active.endDate && new Date(active.endDate).getTime() <= in60.getTime()) {
        alerts.push({ type: "EXPIRING", severity: "medium", message: `${e.name}'s contract expires on ${active.endDate.toISOString().slice(0, 10)}` });
      }
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      if (!e.attendances.some((a) => a.checkIn >= weekAgo)) {
        alerts.push({ type: "ATTENDANCE", severity: "info", message: `${e.name} has no attendance recorded in the last 7 days` });
      }
    }

    const pending = await prisma.timeOffRequest.count({ where: { status: "PENDING" } });
    if (pending) alerts.push({ type: "APPROVAL", severity: "info", message: `${pending} time off request(s) awaiting approval` });

    const failedDlv = await prisma.payslip.count({ where: { deliveryStatus: "FAILED" } });
    if (failedDlv) alerts.push({ type: "DELIVERY", severity: "high", message: `${failedDlv} payslip(s) failed to send` });

    const sev = { high: 0, medium: 1, info: 2 };
    alerts.sort((a, b) => sev[a.severity] - sev[b.severity] || a.message.localeCompare(b.message));
    return res.json({ data: alerts });
  } catch (e) {
    return res.status(500).json({ data: null, error: { code: "SERVER_ERROR", message: e.message } });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`PeoplePay360 backend running on http://localhost:${PORT}`);
});
