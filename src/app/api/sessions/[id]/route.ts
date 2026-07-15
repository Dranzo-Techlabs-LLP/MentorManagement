import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { apiError } from "@/lib/api-helpers";
import type { Prisma } from "@prisma/client";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR", "MENTOR");
    const { id } = await params;
    const session = await prisma.mentoringSession.findUnique({
      where: { id },
      include: {
        mentor: { select: { id: true, name: true } },
        attendance: { include: { student: { select: { id: true, fullName: true } } } },
      },
    });
    if (!session) return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    return NextResponse.json({ ok: true, data: session });
  } catch (e) {
    return apiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("MENTOR", "SUPERVISOR", "CHIEF_MENTOR", "SUPER_ADMIN");
    const { id } = await params;
    const existing = await prisma.mentoringSession.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    const title = body.title ?? existing.title;
    if (!title) return NextResponse.json({ ok: false, error: "Title is required." }, { status: 422 });

    const updated = await prisma.mentoringSession.update({
      where: { id },
      data: {
        title, type: (body.type ?? existing.type) as Prisma.MentoringSessionUpdateInput["type"],
        topic: body.topic ?? existing.topic, agenda: body.agenda ?? existing.agenda,
        scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : existing.scheduledAt,
        durationMins: body.durationMins ?? existing.durationMins,
        meetingLink: body.meetingLink ?? existing.meetingLink, location: body.location ?? existing.location,
        status: (body.status ?? existing.status) as Prisma.MentoringSessionUpdateInput["status"],
      },
    });
    return NextResponse.json({ ok: true, data: updated });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("SUPERVISOR", "CHIEF_MENTOR", "SUPER_ADMIN");
    const { id } = await params;
    const existing = await prisma.mentoringSession.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "Session not found." }, { status: 404 });
    await prisma.mentoringSession.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
