import { NextRequest, NextResponse, after } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, checkRateLimit } from "@/lib/auth";
import { writeAudit } from "@/lib/api-helpers";

/** Register a new organization + admin user (tenant onboarding). */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const name = (body?.name || "").toString().trim();
    const organizationName = (body?.organizationName || "").toString().trim();
    const email = (body?.email || "").toString().trim().toLowerCase();
    const password = (body?.password || "").toString();
    const laboratoryName = (body?.laboratoryName || "").toString().trim() || organizationName;

    if (!name || !organizationName || !email || !password) {
      return NextResponse.json({ error: "Semua field wajib diisi." }, { status: 400 });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ error: "Format email tidak valid." }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "Password minimal 8 karakter." }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!checkRateLimit(`register:${ip}`, 5, 10 * 60 * 1000)) {
      return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi nanti." }, { status: 429 });
    }

    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar." }, { status: 409 });
    }

    const slugBase = organizationName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "org";
    const slug = `${slugBase}-${Date.now().toString(36)}`;

    const passwordHash = await hashPassword(password);
    const org = await db.organization.create({
      data: {
        name: organizationName,
        slug,
        plan: "FREE",
        monthlyAiLimit: 10,
        users: {
          create: {
            name,
            email,
            passwordHash,
            role: "ADMIN",
            isActive: false, // Wajib: Menunggu persetujuan Superadmin sebelum aktif
          },
        },
        laboratories: {
          create: { name: laboratoryName, code: "LAB-01" },
        },
        zscoreRules: {
          create: { ruleVersion: "v1.0-default", satisfactoryLimit: 2, warningLimit: 3, isActive: true },
        },
      },
      include: { users: true },
    });

    const user = org.users[0];

    after(async () => {
      try {
        await writeAudit({
          organizationId: org.id,
          userId: user.id,
          action: "REGISTER",
          entityType: "Organization",
          entityId: org.id,
          details: { organizationName, status: "PENDING_APPROVAL" },
        });
      } catch (e) {
        console.error("[register-audit-error]", e);
      }
    });

    return NextResponse.json(
      {
        ok: true,
        pendingApproval: true,
        message:
          "Pendaftaran berhasil! Akun Anda sedang menunggu persetujuan dari Superadmin. Silakan hubungi Superadmin untuk mengaktifkan akun Anda sebelum masuk.",
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isActive: false,
          organization: { id: org.id, name: org.name, plan: org.plan },
        },
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[register-error]", err);
    return NextResponse.json({ error: "Terjadi kesalahan saat registrasi." }, { status: 500 });
  }
}
