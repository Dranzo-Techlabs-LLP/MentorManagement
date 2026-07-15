import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireRole } from "@/lib/guard";
import { apiError } from "@/lib/api-helpers";
import type { Prisma } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 20;

// GET /api/sessions?status=&page=&pageSize=
export async function GET(req: NextRequest) {
  try {
    await requireRole("SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR", "MENTOR");
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));

    const where: Prisma.MentoringSessionWhereInput = status
      ? { status: status as Prisma.MentoringSessionWhereInput["status"] }
      : {};
    const [items, total] = await Promise.all([
      prisma.mentoringSession.findMany({
        where, orderBy: { scheduledAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize,
        include: { mentor: { select: { id: true, name: true } }, _count: { select: { attendance: true } } },
      }),
      prisma.mentoringSession.count({ where }),
    ]);
    return NextResponse.json({ ok: true, data: items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (e) {
    return apiError(e);
  }
}

// POST /api/sessions
export async function POST(req: NextRequest) {
  try {
    const sess = await requireRole("MENTOR", "SUPERVISOR", "CHIEF_MENTOR", "SUPER_ADMIN");
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });

    const mentorId = body.mentorId || sess.userId;
    const mentorUser = await prisma.user.findUnique({ where: { id: mentorId } });
    if (!mentorUser || mentorUser.role !== "MENTOR") {
      return NextResponse.json({ ok: false, error: "Selected mentor is invalid." }, { status: 422 });
    }

    const session = await prisma.mentoringSession.create({
      data: {
        mentorId, type: (body.type || "ONLINE") as Prisma.MentoringSessionCreateInput["type"],
        title: body.title || "Mentoring Session", topic: body.topic ?? null, agenda: body.agenda ?? null,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : new Date(),
        durationMins: body.durationMins ?? 45, meetingLink: body.meetingLink ?? null, location: body.location ?? null,
        createdById: sess.userId,
        attendance: Array.isArray(body.studentIds)
          ? { create: body.studentIds.map((studentId: string) => ({ studentId })) }
          : undefined,
      },
    });
    const actor = await getSession();
    await prisma.auditLog.create({
      data: { userId: actor?.userId, action: "CREATE", entity: "MentoringSession", entityId: session.id },
    }).catch(() => {});
    return NextResponse.json({ ok: true, data: session }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
