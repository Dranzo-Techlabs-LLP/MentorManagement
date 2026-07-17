import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { studentInputSchema, zodFieldError } from "@/lib/validation";
import { apiError } from "@/lib/api-helpers";
import { ageFromDob, ageCategory } from "@/lib/utils";
import type { AgeCategory as AgeCategoryType, Prisma } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 20;

// GET /api/students?q=&page=&pageSize=  — paginated, searchable list
export async function GET(req: NextRequest) {
  try {
    await requirePermission("students", "view");
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));

    const where: Prisma.StudentWhereInput = q ? { fullName: { contains: q } } : {};
    const [items, total] = await Promise.all([
      prisma.student.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          institution: { select: { id: true, name: true } },
          mentor: { select: { id: true, name: true } },
          parent: { select: { id: true, name: true } },
        },
      }),
      prisma.student.count({ where }),
    ]);
    return NextResponse.json({
      ok: true, data: items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e) {
    return apiError(e);
  }
}

// POST /api/students  — create
export async function POST(req: NextRequest) {
  try {
    await requirePermission("students", "create");
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = studentInputSchema.safeParse({
      fullName: body.fullName, email: body.email ?? null, phone: body.phone ?? null, dob: body.dob ?? null,
    });
    if (!parsed.success) return NextResponse.json({ ok: false, error: zodFieldError(parsed) }, { status: 422 });

    const institutionId: string | null = body.institutionId || null;
    const mentorId: string | null = body.mentorId || null;
    const parentId: string | null = body.parentId || null;
    const [inst, mentorUser, parentUser] = await Promise.all([
      institutionId ? prisma.institution.findUnique({ where: { id: institutionId } }) : null,
      mentorId ? prisma.user.findUnique({ where: { id: mentorId } }) : null,
      parentId ? prisma.user.findUnique({ where: { id: parentId } }) : null,
    ]);
    if (institutionId && !inst) return NextResponse.json({ ok: false, error: "Selected institution does not exist." }, { status: 422 });
    if (mentorId && (!mentorUser || mentorUser.role !== "MENTOR")) return NextResponse.json({ ok: false, error: "Selected mentor is invalid." }, { status: 422 });
    if (parentId && (!parentUser || parentUser.role !== "PARENT")) return NextResponse.json({ ok: false, error: "Selected parent is invalid." }, { status: 422 });

    const dob = body.dob ? new Date(body.dob) : null;
    const student = await prisma.student.create({
      data: {
        fullName: parsed.data.fullName,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        dob,
        ageCategory: ageCategory(ageFromDob(dob)) as AgeCategoryType | null,
        gender: body.gender ?? null,
        className: body.className ?? null,
        rollNo: body.rollNo ?? null,
        city: body.city ?? null,
        bloodGroup: body.bloodGroup ?? null,
        address: body.address ?? null,
        interests: body.interests ?? null,
        talents: body.talents ?? null,
        institutionId, mentorId, parentId,
      },
    });
    const sess = await getSession();
    await prisma.auditLog.create({
      data: { userId: sess?.userId, action: "CREATE", entity: "Student", entityId: student.id },
    }).catch(() => {});
    return NextResponse.json({ ok: true, data: student }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
