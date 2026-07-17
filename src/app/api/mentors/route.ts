import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, hashPassword } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { mentorInputSchema, zodFieldError } from "@/lib/validation";
import { apiError } from "@/lib/api-helpers";
import type { Prisma } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 20;

// GET /api/mentors?q=&page=&pageSize=
export async function GET(req: NextRequest) {
  try {
    await requirePermission("mentors", "view");
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));

    const where: Prisma.UserWhereInput = {
      role: "MENTOR",
      ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { name: "asc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          institution: { select: { id: true, name: true } },
          manager: { select: { id: true, name: true } },
          _count: { select: { studentsAsMentor: true, mentoredSessions: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);
    const data = items.map(({ passwordHash: _passwordHash, ...rest }) => rest);
    return NextResponse.json({
      ok: true, data, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)),
    });
  } catch (e) {
    return apiError(e);
  }
}

// POST /api/mentors  — create a mentor
export async function POST(req: NextRequest) {
  try {
    await requirePermission("mentors", "create");
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = mentorInputSchema.safeParse({
      name: body.name, email: body.email, phone: body.phone ?? null, yearsExperience: body.yearsExperience ?? null,
    });
    if (!parsed.success) return NextResponse.json({ ok: false, error: zodFieldError(parsed) }, { status: 422 });

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) return NextResponse.json({ ok: false, error: "Email already in use." }, { status: 409 });

    const institutionId: string | null = body.institutionId || null;
    const managerId: string | null = body.managerId || null;
    if (institutionId && !(await prisma.institution.findUnique({ where: { id: institutionId } }))) {
      return NextResponse.json({ ok: false, error: "Selected institution does not exist." }, { status: 422 });
    }
    if (managerId && !(await prisma.user.findUnique({ where: { id: managerId } }))) {
      return NextResponse.json({ ok: false, error: "Selected supervisor does not exist." }, { status: 422 });
    }

    const passwordHash = await hashPassword(body.password || "Elevate@123");
    const mentor = await prisma.user.create({
      data: {
        name: parsed.data.name, email: parsed.data.email, passwordHash, role: "MENTOR",
        phone: parsed.data.phone || null, title: body.title ?? null, institutionId, managerId,
        mentoringMode: body.mentoringMode || null, city: body.city ?? null, timezone: body.timezone ?? null,
        languages: body.languages ?? null, exposure: body.exposure ?? null,
        yearsExperience: parsed.data.yearsExperience ?? null,
      },
    });
    const sess = await getSession();
    await prisma.auditLog.create({
      data: { userId: sess?.userId, action: "CREATE", entity: "User", entityId: mentor.id, meta: { role: "MENTOR" } },
    }).catch(() => {});
    const { passwordHash: _ph, ...safe } = mentor;
    return NextResponse.json({ ok: true, data: safe }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
