import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { apiError } from "@/lib/api-helpers";
import type { Prisma } from "@prisma/client";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR");
    const { id } = await params;
    const announcement = await prisma.announcement.findUnique({
      where: { id }, include: { author: { select: { id: true, name: true } } },
    });
    if (!announcement) return NextResponse.json({ ok: false, error: "Announcement not found." }, { status: 404 });
    return NextResponse.json({ ok: true, data: announcement });
  } catch (e) {
    return apiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR");
    const { id } = await params;
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "Announcement not found." }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    const title = body.title ?? existing.title;
    const bodyText = body.body ?? existing.body;
    if (!title || !bodyText) return NextResponse.json({ ok: false, error: "Title and body are required." }, { status: 422 });

    const updated = await prisma.announcement.update({
      where: { id },
      data: {
        title, body: bodyText,
        audience: (body.audience ?? existing.audience) as Prisma.AnnouncementUpdateInput["audience"],
        institutionId: body.institutionId !== undefined ? body.institutionId || null : existing.institutionId,
        pinned: body.pinned !== undefined ? !!body.pinned : existing.pinned,
      },
    });
    return NextResponse.json({ ok: true, data: updated });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("SUPER_ADMIN", "CHIEF_MENTOR");
    const { id } = await params;
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "Announcement not found." }, { status: 404 });
    await prisma.announcement.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
