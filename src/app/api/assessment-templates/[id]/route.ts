import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { apiError } from "@/lib/api-helpers";
import type { Prisma } from "@prisma/client";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("assessments", "view");
    const { id } = await params;
    const template = await prisma.assessmentTemplate.findUnique({
      where: { id }, include: { _count: { select: { instances: true } } },
    });
    if (!template) return NextResponse.json({ ok: false, error: "Template not found." }, { status: 404 });
    return NextResponse.json({ ok: true, data: template });
  } catch (e) {
    return apiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("assessments", "edit");
    const { id } = await params;
    const existing = await prisma.assessmentTemplate.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "Template not found." }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    const title = body.title ?? existing.title;
    if (!title) return NextResponse.json({ ok: false, error: "Title is required." }, { status: 422 });
    if (body.questions !== undefined && !Array.isArray(body.questions)) {
      return NextResponse.json({ ok: false, error: "Questions must be an array." }, { status: 422 });
    }

    const updated = await prisma.assessmentTemplate.update({
      where: { id },
      data: {
        title, description: body.description ?? existing.description,
        level: (body.level ?? existing.level) as Prisma.AssessmentTemplateUpdateInput["level"],
        category: (body.category ?? existing.category) as Prisma.AssessmentTemplateUpdateInput["category"],
        ageMin: body.ageMin ?? existing.ageMin, ageMax: body.ageMax ?? existing.ageMax,
        durationMins: body.durationMins ?? existing.durationMins,
        questions: (body.questions ?? existing.questions) as Prisma.InputJsonValue,
        scoring: (body.scoring ?? existing.scoring) as Prisma.InputJsonValue,
        isActive: body.isActive !== undefined ? !!body.isActive : existing.isActive,
      },
    });
    return NextResponse.json({ ok: true, data: updated });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("assessments", "delete");
    const { id } = await params;
    const existing = await prisma.assessmentTemplate.findUnique({
      where: { id }, select: { title: true, _count: { select: { instances: true } } },
    });
    if (!existing) return NextResponse.json({ ok: false, error: "Template not found." }, { status: 404 });
    if (existing._count.instances > 0) {
      return NextResponse.json(
        { ok: false, error: `Cannot delete — ${existing._count.instances} student assessment(s) use this template. Mark it inactive instead.` },
        { status: 409 },
      );
    }
    await prisma.assessmentTemplate.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
