import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { Role, User } from "@prisma/client";

export function generateTempPassword(): string {
  return crypto.randomBytes(9).toString("base64url");
}

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

export async function ensureAdminUser(): Promise<User> {
  const email = process.env.ADMIN_EMAIL;
  if (!email) {
    throw new Error("ADMIN_EMAIL environment variable is required to bootstrap the admin account");
  }
  return ensureBootstrapUser({ email, role: "ADMIN", label: "ADMIN" });
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
  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const user = await prisma.user.create({ data: { email, name, passwordHash, role: "USER" } });
  return { user, tempPassword };
}
