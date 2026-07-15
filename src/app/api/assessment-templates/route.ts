import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { apiError } from "@/lib/api-helpers";
import type { Prisma } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 20;

// GET /api/assessment-templates?page=&pageSize=
export async function GET(req: NextRequest) {
  try {
    await requireRole("SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR", "MENTOR");
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));

    const [items, total] = await Promise.all([
      prisma.assessmentTemplate.findMany({
        orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
        include: { _count: { select: { instances: true } } },
      }),
      prisma.assessmentTemplate.count(),
    ]);
    return NextResponse.json({ ok: true, data: items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (e) {
    return apiError(e);
  }
}

// POST /api/assessment-templates
export async function POST(req: NextRequest) {
  try {
    const sess = await requireRole("SUPER_ADMIN", "CHIEF_MENTOR");
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    if (!body.title) return NextResponse.json({ ok: false, error: "Title is required." }, { status: 422 });
    if (body.questions !== undefined && !Array.isArray(body.questions)) {
      return NextResponse.json({ ok: false, error: "Questions must be an array." }, { status: 422 });
    }

    const template = await prisma.assessmentTemplate.create({
      data: {
        title: body.title, description: body.description ?? null,
        level: (body.level || "GENERAL") as Prisma.AssessmentTemplateCreateInput["level"],
        category: body.category as Prisma.AssessmentTemplateCreateInput["category"],
        ageMin: body.ageMin ?? null, ageMax: body.ageMax ?? null, durationMins: body.durationMins ?? null,
        questions: (body.questions ?? []) as Prisma.InputJsonValue,
        scoring: (body.scoring ?? null) as Prisma.InputJsonValue,
        createdById: sess.userId,
      },
    });
    return NextResponse.json({ ok: true, data: template }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
