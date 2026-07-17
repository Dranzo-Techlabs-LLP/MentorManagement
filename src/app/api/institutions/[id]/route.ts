import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { institutionInputSchema, zodFieldError } from "@/lib/validation";
import { apiError } from "@/lib/api-helpers";
import type { Prisma } from "@prisma/client";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("institutions", "view");
    const { id } = await params;
    const institution = await prisma.institution.findUnique({
      where: { id }, include: { _count: { select: { students: true, users: true } } },
    });
    if (!institution) return NextResponse.json({ ok: false, error: "Institution not found." }, { status: 404 });
    return NextResponse.json({ ok: true, data: institution });
  } catch (e) {
    return apiError(e);
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("institutions", "edit");
    const { id } = await params;
    const existing = await prisma.institution.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "Institution not found." }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });

    const parsed = institutionInputSchema.safeParse({
      name: body.name ?? existing.name, contactEmail: body.contactEmail ?? existing.contactEmail,
    });
    if (!parsed.success) return NextResponse.json({ ok: false, error: zodFieldError(parsed) }, { status: 422 });

    const updated = await prisma.institution.update({
      where: { id },
      data: {
        name: parsed.data.name,
        type: (body.type ?? existing.type) as Prisma.InstitutionUpdateInput["type"],
        city: body.city ?? existing.city, address: body.address ?? existing.address,
        contactName: body.contactName ?? existing.contactName, contactPhone: body.contactPhone ?? existing.contactPhone,
        contactEmail: parsed.data.contactEmail || null,
      },
    });
    return NextResponse.json({ ok: true, data: updated });
  } catch (e) {
    return apiError(e);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("institutions", "delete");
    const { id } = await params;
    const existing = await prisma.institution.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "Institution not found." }, { status: 404 });
    await prisma.institution.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
