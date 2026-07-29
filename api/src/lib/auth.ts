import jwt from "jsonwebtoken";
import crypto from "crypto";
import type { Request, Response, NextFunction } from "express";
import { prisma } from "./prisma";
import type { Project, Role, User } from "@prisma/client";

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_TOKEN_TTL = "15m";
const REFRESH_TOKEN_TTL = "30d";
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;

declare module "express-serve-static-core" {
  interface Request {
    user?: { id: string; role: Role };
    effectiveUserId?: string;
    readOnly?: boolean;
    project?: Project;
  }
}

export class AuthError extends Error {}

export type SafeUser = Pick<User, "id" | "email" | "name" | "avatarUrl" | "role" | "createdAt" | "deactivatedAt">;

export function toSafeUser(user: User): SafeUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: user.role,
    createdAt: user.createdAt,
    deactivatedAt: user.deactivatedAt,
  };
}

export function signAccessToken(user: Pick<User, "id" | "role">): string {
  return jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

function hashToken(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// Two-step issuance: create the DB row first (so the JWT can embed its id as
// `jti`), sign the JWT, then store the hash of the *signed* token back onto
// that row. The row id alone isn't guessable, but hashing the full token
// means a leaked DB (without the signing secret) still can't produce usable
// refresh tokens.
export async function issueRefreshToken(userId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  const row = await prisma.refreshToken.create({ data: { userId, tokenHash: "", expiresAt } });
  const raw = jwt.sign({ sub: userId, jti: row.id }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_TOKEN_TTL });
  await prisma.refreshToken.update({ where: { id: row.id }, data: { tokenHash: hashToken(raw) } });
  return raw;
}

export async function rotateRefreshToken(
  rawToken: string,
): Promise<{ accessToken: string; refreshToken: string; user: SafeUser }> {
  let payload: { sub: string; jti: string };
  try {
    payload = jwt.verify(rawToken, JWT_REFRESH_SECRET) as unknown as { sub: string; jti: string };
  } catch {
    throw new AuthError("Invalid refresh token");
  }
  const row = await prisma.refreshToken.findUnique({ where: { id: payload.jti } });
  if (!row || row.revokedAt || row.expiresAt < new Date() || row.tokenHash !== hashToken(rawToken)) {
    throw new AuthError("Invalid refresh token");
  }
  // Rotation: revoke the presented token before issuing a new one. If this
  // same token is ever presented again, the revokedAt check above rejects
  // it — that's the signal a token was reused/stolen.
  await prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
  const user = await prisma.user.findUnique({ where: { id: row.userId } });
  // Also checked here, so deactivating someone ends the session they already
  // have rather than waiting for their access token to lapse.
  if (!user || user.deactivatedAt) throw new AuthError("Invalid refresh token");
  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);
  return { accessToken, refreshToken, user: toSafeUser(user) };
}

export async function revokeRefreshToken(rawToken: string | undefined): Promise<void> {
  if (!rawToken) return;
  try {
    const payload = jwt.verify(rawToken, JWT_REFRESH_SECRET) as unknown as { jti: string };
    await prisma.refreshToken.updateMany({ where: { id: payload.jti, revokedAt: null }, data: { revokedAt: new Date() } });
  } catch {
    // Already invalid/expired — logging out with a stale cookie is a no-op.
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as unknown as { sub: string; role: "ADMIN" | "USER" };
    req.user = { id: payload.sub, role: payload.role };
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "TOKEN_EXPIRED" });
      return;
    }
    res.status(401).json({ error: "Not authenticated" });
  }
}

// Full admin: user management and anything that writes.
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

// Either admin tier — for reads: listing accounts and drilling into their
// data. ADMIN_READONLY stops here and never reaches the mutating routes.
export function requireAdminView(req: Request, res: Response, next: NextFunction) {
  if (req.user?.role !== "ADMIN" && req.user?.role !== "ADMIN_READONLY") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

// Lets an admin pass ?asUserId=<id> on GET requests to view another user's
// data read-only. Any non-GET request always operates as the caller's own
// user, so a mutation aimed at someone else's data simply won't find it via
// the ownership lookups in the project/category/transaction routes.
export function withEffectiveUser(req: Request, res: Response, next: NextFunction) {
  const requested = typeof req.query.asUserId === "string" ? req.query.asUserId : undefined;
  if (requested && req.method === "GET") {
    if (req.user?.role !== "ADMIN" && req.user?.role !== "ADMIN_READONLY") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    req.effectiveUserId = requested;
    req.readOnly = true;
  } else {
    req.effectiveUserId = req.user!.id;
    req.readOnly = false;
  }
  next();
}
