import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { mentorInputSchema, zodFieldError } from "@/lib/validation";
import { apiError } from "@/lib/api-helpers";

// GET /api/mentors/:id
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("mentors", "view");
    const { id } = await params;
    const mentor = await prisma.user.findFirst({
      where: { id, role: "MENTOR" },
      include: {
        institution: { select: { id: true, name: true } },
        manager: { select: { id: true, name: true } },
        studentsAsMentor: { select: { id: true, fullName: true, className: true, status: true } },
        _count: { select: { studentsAsMentor: true, mentoredSessions: true } },
      },
    });
    if (!mentor) return NextResponse.json({ ok: false, error: "Mentor not found." }, { status: 404 });
    const { passwordHash: _ph, ...safe } = mentor;
    return NextResponse.json({ ok: true, data: safe });
  } catch (e) {
    return apiError(e);
  }
}

// PUT /api/mentors/:id
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requirePermission("mentors", "edit");
    const { id } = await params;
    const existing = await prisma.user.findFirst({ where: { id, role: "MENTOR" } });
    if (!existing) return NextResponse.json({ ok: false, error: "Mentor not found." }, { status: 404 });

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = mentorInputSchema.safeParse({
      name: body.name ?? existing.name,
      email: body.email ?? existing.email,
      phone: body.phone ?? existing.phone,
      yearsExperience: body.yearsExperience ?? existing.yearsExperience,
    });
    if (!parsed.success) return NextResponse.json({ ok: false, error: zodFieldError(parsed) }, { status: 422 });

    const dupe = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (dupe && dupe.id !== id) return NextResponse.json({ ok: false, error: "Email already in use." }, { status: 409 });

    const institutionId: string | null = body.institutionId !== undefined ? body.institutionId || null : existing.institutionId;
    const managerId: string | null = body.managerId !== undefined ? body.managerId || null : existing.managerId;

    const updated = await prisma.user.update({
      where: { id },
      data: {
        name: parsed.data.name, email: parsed.data.email,
        phone: parsed.data.phone || null, title: body.title ?? existing.title,
        institutionId, managerId,
        mentoringMode: body.mentoringMode !== undefined ? (body.mentoringMode || null) : existing.mentoringMode,
        city: body.city ?? existing.city, timezone: body.timezone ?? existing.timezone,
        languages: body.languages ?? existing.languages, exposure: body.exposure ?? existing.exposure,
        yearsExperience: parsed.data.yearsExperience ?? null,
      },
    });
    const sess = await getSession();
    await prisma.auditLog.create({
      data: { userId: sess?.userId, action: "UPDATE", entity: "User", entityId: id },
    }).catch(() => {});
    const { passwordHash: _ph, ...safe } = updated;
    return NextResponse.json({ ok: true, data: safe });
  } catch (e) {
    return apiError(e);
  }
}

// DELETE /api/mentors/:id
// Hard-deletes only mentors with no session/messaging history (see actions.ts deleteUser
// for the full rationale); otherwise returns a clear, itemized 409 explaining why, and
// recommends deactivation instead.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sess = await requirePermission("mentors", "delete");
    const { id } = await params;
    if (id === sess.userId) {
      return NextResponse.json({ ok: false, error: "You cannot delete your own account." }, { status: 400 });
    }
    const mentor = await prisma.user.findFirst({ where: { id, role: "MENTOR" } });
    if (!mentor) return NextResponse.json({ ok: false, error: "Mentor not found." }, { status: 404 });

    const [sessionCount, sentMsg, recvMsg] = await Promise.all([
      prisma.mentoringSession.count({ where: { mentorId: id } }),
      prisma.message.count({ where: { senderId: id } }),
      prisma.message.count({ where: { recipientId: id } }),
    ]);
    const msgCount = sentMsg + recvMsg;
    const blockers: string[] = [];
    if (sessionCount) blockers.push(`${sessionCount} mentoring session${sessionCount > 1 ? "s" : ""}`);
    if (msgCount) blockers.push(`${msgCount} message${msgCount > 1 ? "s" : ""}`);
    if (blockers.length) {
      return NextResponse.json(
        { ok: false, error: `Cannot delete — this mentor has ${blockers.join(" and ")} on record. Deactivate instead to preserve that history.` },
        { status: 409 },
      );
    }

    await prisma.student.updateMany({ where: { mentorId: id }, data: { mentorId: null } });
    await prisma.user.delete({ where: { id } });
    await prisma.auditLog.create({
      data: { userId: sess.userId, action: "DELETE", entity: "User", entityId: id, meta: { name: mentor.name, role: "MENTOR" } },
    }).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (e) {
    return apiError(e);
  }
}
