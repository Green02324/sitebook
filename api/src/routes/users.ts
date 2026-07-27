import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { ah } from "../lib/asyncHandler";
import { requireAuth, requireAdmin, toSafeUser } from "../lib/auth";
import { createUserByAdmin } from "../lib/users";

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
  requireAdmin,
  ah(async (req, res) => {
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { projects: true } } },
    });
    res.json(users.map((u) => ({ ...toSafeUser(u), projectCount: u._count.projects })));
  }),
);

router.get(
  "/:id",
  requireAdmin,
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

export default router;
