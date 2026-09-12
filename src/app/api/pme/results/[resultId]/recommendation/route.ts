import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { withAuth, writeAudit } from "@/lib/api-helpers";

/**
 * PUT /api/pme/results/:resultId/recommendation
 * Menyimpan / memperbarui rekomendasi mutu secara manual oleh petugas laboratorium.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ resultId: string }> }) {
  return withAuth(req, async ({ user }) => {
    const { resultId } = await params;
    const result = await db.pmeResult.findFirst({
      where: { id: resultId, organizationId: user.organizationId },
    });
    if (!result) {
      return NextResponse.json({ error: "Hasil PME tidak ditemukan." }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const interpretation = typeof body.interpretation === "string" ? body.interpretation.trim() : "";

    if (!interpretation) {
      return NextResponse.json({ error: "Teks rekomendasi mutu tidak boleh kosong." }, { status: 400 });
    }

    const saved = await db.aiAnalysis.upsert({
      where: { resultId: result.id },
      create: {
        resultId: result.id,
        interpretation,
        possibleCauses: "[]",
        investigationSteps: "[]",
        correctiveActions: "[]",
        preventiveActions: "[]",
        provider: "MANUAL",
        model: "manual-input",
        promptVersion: "manual-1.0",
      },
      update: {
        interpretation,
      },
    });

    await db.pmeResult.update({
      where: { id: result.id },
      data: { analysisStatus: "DONE" },
    });

    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "EDIT_RESULT",
      entityType: "AiAnalysis",
      entityId: saved.id,
      details: { parameter: result.parameterName, mode: "MANUAL_RECOMMENDATION" },
    });

    return NextResponse.json({
      ok: true,
      message: "Rekomendasi mutu manual berhasil disimpan.",
      aiAnalysis: {
        interpretation: saved.interpretation,
        possibleCauses: saved.possibleCauses,
        investigationSteps: saved.investigationSteps,
        correctiveActions: saved.correctiveActions,
        preventiveActions: saved.preventiveActions,
      },
    });
  });
}

/**
 * DELETE /api/pme/results/:resultId/recommendation
 * Mengosongkan / mereset rekomendasi mutu kembali ke status belum dianalisa.
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ resultId: string }> }) {
  return withAuth(req, async ({ user }) => {
    const { resultId } = await params;
    const result = await db.pmeResult.findFirst({
      where: { id: resultId, organizationId: user.organizationId },
    });
    if (!result) {
      return NextResponse.json({ error: "Hasil PME tidak ditemukan." }, { status: 404 });
    }

    await db.aiAnalysis.deleteMany({
      where: { resultId: result.id },
    });

    await db.pmeResult.update({
      where: { id: result.id },
      data: { analysisStatus: "PENDING" },
    });

    await writeAudit({
      organizationId: user.organizationId,
      userId: user.id,
      action: "EDIT_RESULT",
      entityType: "AiAnalysis",
      entityId: result.id,
      details: { parameter: result.parameterName, mode: "RESET_RECOMMENDATION" },
    });

    return NextResponse.json({
      ok: true,
      message: "Rekomendasi mutu berhasil dikosongkan / direset.",
    });
  });
}
