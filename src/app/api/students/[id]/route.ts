import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requireRole } from "@/lib/guard";
import { studentInputSchema, zodFieldError } from "@/lib/validation";
import { apiError } from "@/lib/api-helpers";
import { ageFromDob, ageCategory } from "@/lib/utils";
import type { AgeCategory as AgeCategoryType } from "@prisma/client";

// GET /api/students/:id
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR");
    const { id } = await params;
    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        institution: { select: { id: true, name: true } },
        mentor: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
      },
    });
    if (!student) return NextResponse.json({ ok: false, error: "Student not found." }, { status: 404 });
    return NextResponse.json({ ok: true, data: student });
  } catch (e) {
    return apiError(e);
  }
}

// PUT /api/students/:id — full update. Also handles mentor assign/unassign via { mentorId }.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR");
    const { id } = await params;
    const existing = await prisma.student.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ ok: false, error: "Student not found." }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = studentInputSchema.safeParse({
      fullName: body.fullName ?? existing.fullName,
      email: body.email ?? existing.email,
      phone: body.phone ?? existing.phone,
      dob: body.dob ?? existing.dob?.toISOString() ?? null,
    });
    if (!parsed.success) return NextResponse.json({ ok: false, error: zodFieldError(parsed) }, { status: 422 });

    const institutionId: string | null = body.institutionId !== undefined ? body.institutionId || null : existing.institutionId;
    const mentorId: string | null = body.mentorId !== undefined ? body.mentorId || null : existing.mentorId;
    const parentId: string | null = body.parentId !== undefined ? body.parentId || null : existing.parentId;
    const [inst, mentorUser, parentUser] = await Promise.all([
      institutionId ? prisma.institution.findUnique({ where: { id: institutionId } }) : null,
      mentorId ? prisma.user.findUnique({ where: { id: mentorId } }) : null,
      parentId ? prisma.user.findUnique({ where: { id: parentId } }) : null,
    ]);
    if (institutionId && !inst) return NextResponse.json({ ok: false, error: "Selected institution does not exist." }, { status: 422 });
    if (mentorId && (!mentorUser || mentorUser.role !== "MENTOR")) return NextResponse.json({ ok: false, error: "Selected mentor is invalid." }, { status: 422 });
    if (parentId && (!parentUser || parentUser.role !== "PARENT")) return NextResponse.json({ ok: false, error: "Selected parent is invalid." }, { status: 422 });

    const dob = body.dob !== undefined ? (body.dob ? new Date(body.dob) : null) : existing.dob;
    const updated = await prisma.student.update({
      where: { id },
      data: {
        fullName: parsed.data.fullName,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        dob,
        ageCategory: ageCategory(ageFromDob(dob)) as AgeCategoryType | null,
        gender: body.gender ?? existing.gender,
        className: body.className ?? existing.className,
        rollNo: body.rollNo ?? existing.rollNo,
        city: body.city ?? existing.city,
        bloodGroup: body.bloodGroup ?? existing.bloodGroup,
        address: body.address ?? existing.address,
        interests: body.interests ?? existing.interests,
        talents: body.talents ?? existing.talents,
        institutionId, mentorId, parentId,
      },
    });
    const sess = await getSession();
    await prisma.auditLog.create({
      data: { userId: sess?.userId, action: "UPDATE", entity: "Student", entityId: id },
    }).catch(() => {});
    return NextResponse.json({ ok: true, data: updated });
  } catch (e) {
    return apiError(e);
  }
}

// DELETE /api/students/:id
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("SUPER_ADMIN");
    const { id } = await params;
    const existing = await prisma.student.findUnique({ where: { id }, select: { id: true, fullName: true } });
    if (!existing) return NextResponse.json({ ok: false, error: "Student not found." }, { status: 404 });

    await prisma.student.delete({ where: { id } });
    const sess = await getSession();
    await prisma.auditLog.create({
      data: { userId: sess?.userId, action: "DELETE", entity: "Student", entityId: id, meta: { fullName: existing.fullName } },
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
