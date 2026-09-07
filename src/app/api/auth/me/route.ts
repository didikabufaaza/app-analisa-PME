import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth";
import { countMonthlyUsage } from "@/services/ai/extraction-service";

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }
  const used = await countMonthlyUsage(user.organizationId);
  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      menuAccess: user.menuAccess ? JSON.parse(user.menuAccess) : null,
      organization: {
        id: user.organization.id,
        name: user.organization.name,
        plan: user.organization.plan,
        monthlyAiLimit: user.organization.monthlyAiLimit,
      },
      aiUsage: { used, limit: user.organization.monthlyAiLimit },
    },
  });
}
