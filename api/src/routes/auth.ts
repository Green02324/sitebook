import { Router } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";
import { ah } from "../lib/asyncHandler";
import { signAccessToken, issueRefreshToken, rotateRefreshToken, revokeRefreshToken, toSafeUser, AuthError } from "../lib/auth";

const router = Router();

const REFRESH_COOKIE = "refreshToken";
const REFRESH_COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: "/api/auth",
};

router.post(
  "/login",
  ah(async (req, res) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    const accessToken = signAccessToken(user);
    const refreshToken = await issueRefreshToken(user.id);
    res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS);
    // refreshToken is included in the body (in addition to the cookie) for
    // clients with no cookie jar across restarts, e.g. the mobile app, which
    // stores it itself (expo-secure-store) and resends it explicitly.
    res.json({ accessToken, refreshToken, user: toSafeUser(user) });
  }),
);

router.post(
  "/refresh",
  ah(async (req, res) => {
    const token = (req.body as { refreshToken?: string })?.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    try {
      const { accessToken, refreshToken, user } = await rotateRefreshToken(token);
      res.cookie(REFRESH_COOKIE, refreshToken, REFRESH_COOKIE_OPTS);
      res.json({ accessToken, refreshToken, user });
    } catch (err) {
      if (err instanceof AuthError) {
        res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
        res.status(401).json({ error: "Invalid refresh token" });
        return;
      }
      throw err;
    }
  }),
);

router.post(
  "/logout",
  ah(async (req, res) => {
    const token = (req.body as { refreshToken?: string })?.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
    await revokeRefreshToken(token);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.json({ ok: true });
  }),
);

export default router;
