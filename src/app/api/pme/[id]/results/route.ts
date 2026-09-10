import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth } from "@/lib/api-helpers";

/** GET /api/pme/:id/results — results list for the session. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withAuth(req, async ({ user }) => {
    const { id } = await params;
    const session = await db.pmeSession.findFirst({ where: { id, organizationId: user.organizationId } });
    if (!session) return NextResponse.json({ error: "Sesi PME tidak ditemukan." }, { status: 404 });

    const results = await db.pmeResult.findMany({
      where: { sessionId: id },
      orderBy: [{ validationStatus: "desc" }, { parameterName: "asc" }],
    });

    return NextResponse.json({
      results: results.map((r) => ({
        id: r.id,
        parameterName: r.parameterName,
        participantValue: r.participantValue,
        targetValue: r.targetValue,
        sdpa: r.sdpa,
        zScore: r.zScore,
        unit: r.unit,
        method: r.method,
        instrument: r.instrument,
        peerGroup: r.peerGroup,
        providerRemark: r.providerRemark,
        allParticipantsCount: r.allParticipantsCount,
        allParticipantsTarget: r.allParticipantsTarget,
        allParticipantsSdpa: r.allParticipantsSdpa,
        allParticipantsZScore: r.allParticipantsZScore,
        allParticipantsStatus: r.allParticipantsStatus,
        methodCount: r.methodCount,
        methodTarget: r.methodTarget,
        methodSdpa: r.methodSdpa,
        methodZScore: r.methodZScore,
        methodStatus: r.methodStatus,
        instrumentCount: r.instrumentCount,
        instrumentTarget: r.instrumentTarget,
        instrumentSdpa: r.instrumentSdpa,
        instrumentZScore: r.instrumentZScore,
        instrumentStatus: r.instrumentStatus,
        zStatus: r.zStatus,
        validationStatus: r.validationStatus,
        analysisStatus: r.analysisStatus,
        reviewStatus: r.reviewStatus,
        issues: JSON.parse(r.issues || "[]"),
        zScoreConfidence: r.zScoreConfidence,
        sourcePage: r.sourcePage,
      })),
    });
  });
}
