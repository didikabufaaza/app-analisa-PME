import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { db } from "@/lib/db";
import type { User, Organization } from "@prisma/client";

export type AuthenticatedUser = User & { organization: Organization };

export function jsonOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code: code || "ERROR" }, { status });
}

type AuthedContext = { user: AuthenticatedUser };

/**
 * Wraps an API handler with authentication + organization scope.
 * Returns 401 when not logged in.
 */
export async function withAuth(
  req: NextRequest,
  handler: (ctx: AuthedContext) => Promise<NextResponse> | NextResponse
): Promise<NextResponse> {
  const user = await getAuthUser(req);
  if (!user) {
    return jsonError("Tidak terautentikasi. Silakan login terlebih dahulu.", 401, "UNAUTHENTICATED");
  }
  if (!user.isActive) {
    return jsonError("Akun Anda telah dinonaktifkan. Hubungi administrator.", 403, "ACCOUNT_DISABLED");
  }
  try {
    return await handler({ user });
  } catch (err) {
    console.error("[api-error]", err);
    const message = err instanceof Error ? err.message : "Terjadi kesalahan internal";
    return jsonError(message, 500, "INTERNAL_ERROR");
  }
}

/** Require ADMIN or SUPERADMIN role, otherwise 403. */
export async function withAdmin(
  req: NextRequest,
  handler: (ctx: AuthedContext) => Promise<NextResponse> | NextResponse
): Promise<NextResponse> {
  return withAuth(req, async ({ user }) => {
    if (user.role !== "ADMIN" && user.role !== "SUPERADMIN") {
      return jsonError("Akses ditolak. Hanya Administrator.", 403, "FORBIDDEN");
    }
    return handler({ user });
  });
}

/** Require SUPERADMIN role, otherwise 403. */
export async function withSuperAdmin(
  req: NextRequest,
  handler: (ctx: AuthedContext) => Promise<NextResponse> | NextResponse
): Promise<NextResponse> {
  return withAuth(req, async ({ user }) => {
    if (user.role !== "SUPERADMIN") {
      return jsonError("Akses ditolak. Fitur ini khusus Super Admin.", 403, "FORBIDDEN");
    }
    return handler({ user });
  });
}

/**
 * Returns the effective organizationId for multi-tenancy.
 * - Non-superadmin: strictly locked to their own user.organizationId.
 * - Superadmin: respects x-tenant-id header, query parameter, or view-as cookie.
 *   If "ALL", returns "ALL".
 */
export function getEffectiveOrgId(user: AuthenticatedUser, req: NextRequest): string {
  if (user.role === "SUPERADMIN") {
    const headerTenant = req.headers.get("x-tenant-id");
    if (headerTenant && headerTenant.trim()) return headerTenant.trim();

    const queryTenant = req.nextUrl.searchParams.get("tenantId");
    if (queryTenant && queryTenant.trim()) return queryTenant.trim();

    const cookieTenant = req.cookies.get("didikpme_view_as_tenant")?.value;
    if (cookieTenant && cookieTenant.trim()) return cookieTenant.trim();

    return "ALL";
  }
  return user.organizationId;
}

export async function writeAudit(params: {
  organizationId: string;
  userId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  details?: unknown;
}) {
  try {
    await db.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId || null,
        action: params.action,
        entityType: params.entityType || null,
        entityId: params.entityId || null,
        details: params.details ? JSON.stringify(params.details) : null,
      },
    });
  } catch (e) {
    console.error("[audit-log-failed]", e);
  }
}

/* AI cost estimate constants (Gemini Flash approximate public pricing) */
export const AI_COST_PER_1M_INPUT = 0.3;
export const AI_COST_PER_1M_OUTPUT = 2.5;

export function estimateCost(inputTokens: number, outputTokens: number): number {
  return (
    (inputTokens / 1_000_000) * AI_COST_PER_1M_INPUT +
    (outputTokens / 1_000_000) * AI_COST_PER_1M_OUTPUT
  );
}
