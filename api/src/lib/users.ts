import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role, User } from "@prisma/client";

export function generateTempPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

// Handed to every new account so it can simply be told to the person, rather
// than relayed. It is deliberately guessable, so it is only safe for as long
// as it takes them to set their own — anyone who knows the convention can
// sign in until they do.
export const DEFAULT_NEW_USER_PASSWORD = "12341234";

function nameFromEmail(email: string): string {
  const local = email.split("@")[0];
  return local.charAt(0).toUpperCase() + local.slice(1);
}

// Idempotent: if a user with this email already exists, it's returned as-is
// (no password reset). Otherwise a fresh account is created with a random
// temporary password, logged once to the console — this is the only place
// that password is ever shown.
export async function ensureBootstrapUser(opts: { email: string; role: Role; label: string }): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { email: opts.email } });
  if (existing) return existing;

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const user = await prisma.user.create({
    data: { email: opts.email, passwordHash, name: nameFromEmail(opts.email), role: opts.role },
  });
  console.log(
    `[bootstrap] Created ${opts.label} account (${opts.email}) with temporary password: ${tempPassword} — change this after first login.`,
  );
  return user;
}

// ADMIN_EMAIL is authoritative, not just a seed: whoever it points at holds
// the admin role, and is reactivated if they'd been switched off. That makes
// moving admin to a different account a matter of changing the variable,
// rather than needing a second account to exist purely to be the admin.
export async function ensureAdminUser(): Promise<User> {
  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    throw new Error("ADMIN_EMAIL environment variable is required to bootstrap the admin account");
  }
  const user = await ensureBootstrapUser({ email, role: "ADMIN", label: "ADMIN" });
  if (user.role === "ADMIN" && user.deactivatedAt === null) return user;

  const promoted = await prisma.user.update({
    where: { id: user.id },
    data: { role: "ADMIN", deactivatedAt: null },
  });
  console.log(`[bootstrap] Granted ADMIN to ${email} (was ${user.role}${user.deactivatedAt ? ", deactivated" : ""}).`);
  return promoted;
}

export async function ensureOwnerUser(): Promise<User> {
  const email = process.env.OWNER_EMAIL;
  if (!email) {
    throw new Error("OWNER_EMAIL environment variable is required to bootstrap the owner account");
  }
  return ensureBootstrapUser({ email, role: "USER", label: "OWNER" });
}

// Admin-only "add a contractor" flow — there's no public signup, so this is
// the only way a new USER account gets created after bootstrap.
export async function createUserByAdmin(email: string, name: string): Promise<{ user: User; tempPassword: string }> {
  const tempPassword = DEFAULT_NEW_USER_PASSWORD;
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const user = await prisma.user.create({ data: { email, name, passwordHash, role: "USER" } });
  return { user, tempPassword };
}

// Stored passwords are bcrypt hashes, so an admin can never be shown a user's
// existing password — there's nothing to read back. Resetting to a fresh
// random one, surfaced exactly once at the point of reset, is the closest
// equivalent. Every outstanding refresh token is revoked at the same time, so
// sessions opened with the old password can't outlive it.
// Refusing to switch off the last way in is worth a query — an account with
// no active admin can only be recovered by editing the database by hand.
export async function countOtherActiveAdmins(excludeUserId: string): Promise<number> {
  return prisma.user.count({
    where: { role: "ADMIN", deactivatedAt: null, id: { not: excludeUserId } },
  });
}

export async function resetUserPassword(userId: string): Promise<string> {
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
  ]);
  return tempPassword;
}
