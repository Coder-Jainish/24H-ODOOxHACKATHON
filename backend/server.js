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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`PeoplePay360 backend running on http://localhost:${PORT}`);
});
