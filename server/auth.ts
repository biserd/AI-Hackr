import { Request, Response, NextFunction } from "express";
import crypto from "crypto";
import { storage } from "./storage";
import { sendMagicLinkEmail, sendAdminMagicLinkNotification } from "./email";
import type { User } from "@shared/schema";

const MAGIC_LINK_EXPIRY_MINUTES = 15;
const SESSION_EXPIRY_DAYS = 30;

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionId?: string;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const sessionToken = req.cookies?.session;
    
    if (!sessionToken) {
      return next();
    }

    const session = await storage.getSessionByToken(sessionToken);
    
    if (!session) {
      res.clearCookie("session");
      return next();
    }

    if (new Date() > session.expiresAt) {
      await storage.deleteSession(session.id);
      res.clearCookie("session");
      return next();
    }

    const user = await storage.getUser(session.userId);
    
    if (!user) {
      await storage.deleteSession(session.id);
      res.clearCookie("session");
      return next();
    }

    req.user = user;
    req.sessionId = session.id;
    next();
  } catch (error) {
    console.error("[Auth] Middleware error:", error);
    next();
  }
}

export function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  next();
}

// Gate a route to Pro-tier users only. Always run after `requireAuth` (or after
// authMiddleware if anonymous-with-paywall messaging is wanted). Returns a
// machine-readable `error: "pro-required"` so the frontend can render an
// upgrade CTA instead of a generic auth wall.
export function requirePro(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (req.user.planTier !== "pro") {
    res.status(402).json({
      error: "pro-required",
      message: "This feature is available on the Pro plan.",
    });
    return;
  }
  next();
}

export async function requestMagicLink(email: string, baseUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    const normalizedEmail = email.toLowerCase().trim();
    
    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return { success: false, error: "Invalid email address" };
    }

    const token = generateToken();
    const tokenHash = hashToken(token);
    const expiresAt = new Date(Date.now() + MAGIC_LINK_EXPIRY_MINUTES * 60 * 1000);

    await storage.createMagicLink(normalizedEmail, tokenHash, expiresAt);

    const magicLink = `${baseUrl}/auth/verify?token=${token}`;
    // Only print the raw link (which contains the unhashed token) when an
    // operator explicitly opts in via DEBUG_MAGIC_LINKS=1. Otherwise even
    // dev logs would leak credentials to anyone with shell access.
    if (process.env.NODE_ENV !== "production" && process.env.DEBUG_MAGIC_LINKS === "1") {
      console.log(`[Auth][dev] Magic link for ${normalizedEmail}: ${magicLink}`);
    }
    const emailSent = await sendMagicLinkEmail(normalizedEmail, magicLink);

    if (!emailSent) {
      return { success: false, error: "Failed to send email. Please try again." };
    }

    // Notify admin (don't await, fire and forget)
    sendAdminMagicLinkNotification(normalizedEmail).catch(err => {
      console.error("[Auth] Failed to notify admin:", err);
    });

    console.log(`[Auth] Magic link requested for ${normalizedEmail}`);
    return { success: true };
  } catch (error) {
    console.error("[Auth] Error requesting magic link:", error);
    return { success: false, error: "An error occurred. Please try again." };
  }
}

export async function verifyMagicLink(
  token: string,
  res: Response,
  userAgent?: string,
  ipAddress?: string
): Promise<{ success: boolean; user?: User; error?: string }> {
  try {
    const tokenHash = hashToken(token);
    const magicLink = await storage.getMagicLinkByTokenHash(tokenHash);

    if (!magicLink) {
      return { success: false, error: "Invalid or expired link" };
    }

    if (new Date() > magicLink.expiresAt) {
      await storage.consumeMagicLink(magicLink.id);
      return { success: false, error: "This link has expired. Please request a new one." };
    }

    await storage.consumeMagicLink(magicLink.id);

    let user = await storage.getUserByEmail(magicLink.email);
    
    if (!user) {
      user = await storage.createUser({ email: magicLink.email });
      console.log(`[Auth] New user created: ${user.email}`);
    }

    await storage.updateUser(user.id, {
      emailVerified: true,
      lastLoginAt: new Date(),
    });

    const sessionToken = generateToken();
    const sessionExpiresAt = new Date(Date.now() + SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    await storage.createSession(user.id, sessionToken, sessionExpiresAt, userAgent, ipAddress);

    res.cookie("session", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
      path: "/",
    });

    console.log(`[Auth] User logged in: ${user.email}`);
    return { success: true, user };
  } catch (error) {
    console.error("[Auth] Error verifying magic link:", error);
    return { success: false, error: "An error occurred. Please try again." };
  }
}

export async function logout(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    if (req.sessionId) {
      await storage.deleteSession(req.sessionId);
    }
    res.clearCookie("session");
    console.log(`[Auth] User logged out: ${req.user?.email || "unknown"}`);
  } catch (error) {
    console.error("[Auth] Error logging out:", error);
  }
}
