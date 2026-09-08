import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, signSession, getSessionCookieName, checkRateLimit } from "@/lib/auth";
import { writeAudit } from "@/lib/api-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = (body?.email || "").toString().trim().toLowerCase();
    const password = (body?.password || "").toString();

    if (!email || !password) {
      return NextResponse.json({ error: "Email dan password wajib diisi." }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!checkRateLimit(`login:${ip}:${email}`, 15, 5 * 60 * 1000)) {
      return NextResponse.json({ error: "Terlalu banyak percobaan login. Coba lagi dalam beberapa menit." }, { status: 429 });
    }

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
        isActive: true,
        menuAccess: true,
        organizationId: true,
        organization: {
          select: { id: true, name: true, plan: true },
        },
      },
    });

    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return NextResponse.json({ error: "Email atau password salah." }, { status: 401 });
    }

    if (!user.isActive) {
      return NextResponse.json(
        {
          error: "Akun Anda sedang menunggu persetujuan dari Superadmin. Silakan hubungi Superadmin untuk mengaktifkan akun Anda.",
          code: "ACCOUNT_PENDING_APPROVAL",
        },
        { status: 403 }
      );
    }

    const token = await signSession({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      email: user.email,
      name: user.name,
    });

    // Write audit log in background so user receives login response instantly
    after(async () => {
      try {
        await writeAudit({
          organizationId: user.organizationId,
          userId: user.id,
          action: "LOGIN",
          entityType: "User",
          entityId: user.id,
        });
      } catch (e) {
        console.error("[login-audit-error]", e);
      }
    });

    let menuAccess: string[] | null = null;
    try {
      menuAccess = user.menuAccess ? JSON.parse(user.menuAccess) : null;
    } catch {
      menuAccess = null;
    }

    const res = NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        menuAccess,
        organization: { id: user.organization.id, name: user.organization.name, plan: user.organization.plan },
      },
    });
    res.cookies.set(getSessionCookieName(), token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    });
    return res;
  } catch (err) {
    console.error("[login-error]", err);
    return NextResponse.json({ error: "Terjadi kesalahan saat login." }, { status: 500 });
  }
}
