import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "didikpme_session";
const SESSION_DURATION = "7d";

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET || "didikpme-dev-secret-do-not-use-in-prod";
  return new TextEncoder().encode(secret);
}

export interface SessionPayload {
  userId: string;
  organizationId: string;
  role: string;
  email: string;
  name: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_DURATION)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (!payload.userId || !payload.organizationId) return null;
    return {
      userId: payload.userId as string,
      organizationId: payload.organizationId as string,
      role: payload.role as string,
      email: payload.email as string,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}

export function getSessionCookieName(): string {
  return SESSION_COOKIE;
}

/** Resolve the authenticated user (and org) from request cookie. Returns null when unauthenticated. */
export async function getAuthUser(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySessionToken(token);
  if (!payload) return null;
  const user = await db.user.findUnique({
    where: { id: payload.userId },
    include: { organization: true },
  });
  if (!user) return null;
  return user;
}

export interface AuthedUser {
  id: string;
  name: string;
  email: string;
  role: string;
  organizationId: string;
  organization: {
    id: string;
    name: string;
    plan: string;
    monthlyAiLimit: number;
  };
}

/* ---------------- simple in-memory rate limiter ---------------- */
const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, limit = 10, windowMs = 5 * 60 * 1000): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;
}
