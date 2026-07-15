import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireRole } from "@/lib/guard";
import { apiError } from "@/lib/api-helpers";

// GET /api/mentors/:id/students — students currently assigned to this mentor
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR");
    const { id } = await params;
    const mentor = await prisma.user.findFirst({ where: { id, role: "MENTOR" }, select: { id: true } });
    if (!mentor) return NextResponse.json({ ok: false, error: "Mentor not found." }, { status: 404 });

    const students = await prisma.student.findMany({
      where: { mentorId: id },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, className: true, status: true, city: true, ageCategory: true },
    });
    return NextResponse.json({ ok: true, data: students });
  } catch (e) {
    return apiError(e);
  }
}
