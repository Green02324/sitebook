import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { ah } from "../lib/asyncHandler";
import { requireAuth, requireAdmin, requireAdminView, toSafeUser } from "../lib/auth";
import { createUserByAdmin, resetUserPassword, countOtherActiveAdmins } from "../lib/users";
import type { Role } from "@prisma/client";
import { OVERHEAD_LABEL } from "../lib/labels";

const router = Router();
router.use(requireAuth);

router.get(
  "/me",
  ah(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(toSafeUser(user));
  }),
);

router.put(
  "/me",
  ah(async (req, res) => {
    const { name, email, avatarUrl } = req.body as { name?: string; email?: string; avatarUrl?: string | null };
    const data: { name?: string; email?: string; avatarUrl?: string | null } = {};
    if (name !== undefined) data.name = name;
    if (avatarUrl !== undefined) data.avatarUrl = avatarUrl;
    if (email !== undefined) {
      const existing = await prisma.user.findUnique({ where: { email } });
      if (existing && existing.id !== req.user!.id) {
        res.status(409).json({ error: "Email already in use" });
        return;
      }
      data.email = email;
    }
    const user = await prisma.user.update({ where: { id: req.user!.id }, data });
    res.json(toSafeUser(user));
  }),
);

router.put(
  "/me/password",
  ah(async (req, res) => {
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: "Current and new password are required" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    res.json({ ok: true });
  }),
);

router.get(
  "/",
  requireAdminView,
  ah(async (req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { projects: true } } },
    });
    res.json(users.map((u) => ({ ...toSafeUser(u), projectCount: u._count.projects })));
  }),
);

// On-disk size of a table including its indexes, straight from Postgres. The
// table names are a fixed internal list, never user input.
async function relationSize(table: string): Promise<number> {
  const rows = await prisma.$queryRawUnsafe<{ size: bigint }[]>(`SELECT pg_total_relation_size('"${table}"') AS size`);
  return Number(rows[0]?.size ?? 0);
}

// Registered before "/:id" — otherwise "storage" is swallowed as a user id.
router.get(
  "/storage",
  requireAdminView,
  ah(async (_req, res) => {
    const capacityGb = Number(process.env.STORAGE_CAPACITY_GB) || 5;
    const capacityBytes = capacityGb * 1024 ** 3;

    const dbRows = await prisma.$queryRaw<{ size: bigint }[]>`SELECT pg_database_size(current_database()) AS size`;
    const usedBytes = Number(dbRows[0]?.size ?? 0);

    const [transactions, projects, categories, overheadExpenses, overheadCategories, users, refreshTokens] = await Promise.all([
      relationSize("Transaction"),
      relationSize("Project"),
      relationSize("Category"),
      relationSize("OverheadExpense"),
      relationSize("OverheadCategory"),
      relationSize("User"),
      relationSize("RefreshToken"),
    ]);

    const breakdown = [
      { label: "Transactions", bytes: transactions, color: "#0a84ff" },
      { label: "Projects", bytes: projects + categories, color: "#ff9500" },
      { label: OVERHEAD_LABEL, bytes: overheadExpenses + overheadCategories, color: "#af52de" },
      { label: "Accounts & sessions", bytes: users + refreshTokens, color: "#34c759" },
    ];
    const accounted = breakdown.reduce((sum, b) => sum + b.bytes, 0);
    breakdown.push({ label: "System & overhead", bytes: Math.max(0, usedBytes - accounted), color: "#8e8e93" });

    res.json({ capacityBytes, usedBytes, breakdown });
  }),
);

router.get(
  "/:id",
  requireAdminView,
  ah(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!user) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json(toSafeUser(user));
  }),
);

router.post(
  "/",
  requireAdmin,
  ah(async (req, res) => {
    const { email, name } = req.body as { email?: string; name?: string };
    if (!email || !name) {
      res.status(400).json({ error: "Email and name are required" });
      return;
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "A user with this email already exists" });
      return;
    }
    const { user, tempPassword } = await createUserByAdmin(email, name);
    res.status(201).json({ user: toSafeUser(user), tempPassword });
  }),
);

router.put(
  "/:id",
  requireAdmin,
  ah(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const { name, email } = req.body as { name?: string; email?: string };
    const data: { name?: string; email?: string } = {};
    if (name !== undefined) {
      if (!name.trim()) {
        res.status(400).json({ error: "Name cannot be empty" });
        return;
      }
      data.name = name.trim();
    }
    if (email !== undefined) {
      if (!email.trim()) {
        res.status(400).json({ error: "Email cannot be empty" });
        return;
      }
      const clash = await prisma.user.findUnique({ where: { email: email.trim() } });
      if (clash && clash.id !== target.id) {
        res.status(409).json({ error: "Email already in use" });
        return;
      }
      data.email = email.trim();
    }
    const user = await prisma.user.update({ where: { id: target.id }, data });
    res.json(toSafeUser(user));
  }),
);

// Deactivate or restore. Nothing is deleted — the account simply can't sign
// in, and its projects and history stay intact for the record.
router.put(
  "/:id/active",
  requireAdmin,
  ah(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const { active } = req.body as { active?: boolean };
    if (typeof active !== "boolean") {
      res.status(400).json({ error: "active must be true or false" });
      return;
    }

    if (!active) {
      if (target.id === req.user!.id) {
        res.status(400).json({ error: "You cannot deactivate your own account" });
        return;
      }
      if (target.role === "ADMIN" && (await countOtherActiveAdmins(target.id)) === 0) {
        res.status(400).json({ error: "This is the last active admin — promote someone else first" });
        return;
      }
    }

    const user = await prisma.user.update({
      where: { id: target.id },
      data: { deactivatedAt: active ? null : new Date() },
    });
    // Ending their sessions is the point of deactivating; without this they
    // stay signed in until the refresh token lapses. Reactivating leaves the
    // revoked tokens alone — they sign in again and get a fresh one.
    if (!active) {
      await prisma.refreshToken.updateMany({
        where: { userId: target.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    res.json(toSafeUser(user));
  }),
);

router.put(
  "/:id/role",
  requireAdmin,
  ah(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const { role } = req.body as { role?: Role };
    if (role !== "ADMIN" && role !== "ADMIN_READONLY" && role !== "USER") {
      res.status(400).json({ error: "role must be ADMIN, ADMIN_READONLY, or USER" });
      return;
    }
    if (target.id === req.user!.id && role !== "ADMIN") {
      res.status(400).json({ error: "You cannot remove your own admin access" });
      return;
    }
    if (target.role === "ADMIN" && role !== "ADMIN" && (await countOtherActiveAdmins(target.id)) === 0) {
      res.status(400).json({ error: "This is the last active admin — promote someone else first" });
      return;
    }
    const user = await prisma.user.update({ where: { id: target.id }, data: { role } });
    res.json(toSafeUser(user));
  }),
);

// There is no "read the current password" counterpart: passwords are stored
// only as bcrypt hashes. This issues a new one and returns it once.
router.post(
  "/:id/reset-password",
  requireAdmin,
  ah(async (req, res) => {
    const target = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!target) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const tempPassword = await resetUserPassword(target.id);
    res.json({ email: target.email, tempPassword });
  }),
);

export default router;
