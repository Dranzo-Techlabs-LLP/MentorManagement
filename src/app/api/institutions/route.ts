import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/permissions";
import { institutionInputSchema, zodFieldError } from "@/lib/validation";
import { apiError } from "@/lib/api-helpers";
import type { Prisma } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 20;

// GET /api/institutions?page=&pageSize=
export async function GET(req: NextRequest) {
  try {
    await requirePermission("institutions", "view");
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));

    const [items, total] = await Promise.all([
      prisma.institution.findMany({
        orderBy: { name: "asc" }, skip: (page - 1) * pageSize, take: pageSize,
        include: { _count: { select: { students: true, users: true } } },
      }),
      prisma.institution.count(),
    ]);
    return NextResponse.json({ ok: true, data: items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (e) {
    return apiError(e);
  }
}

// POST /api/institutions
export async function POST(req: NextRequest) {
  try {
    await requirePermission("institutions", "create");
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });

    const parsed = institutionInputSchema.safeParse({ name: body.name, contactEmail: body.contactEmail ?? null });
    if (!parsed.success) return NextResponse.json({ ok: false, error: zodFieldError(parsed) }, { status: 422 });

    const institution = await prisma.institution.create({
      data: {
        name: parsed.data.name,
        type: (body.type || "SCHOOL") as Prisma.InstitutionCreateInput["type"],
        city: body.city ?? null, address: body.address ?? null,
        contactName: body.contactName ?? null, contactPhone: body.contactPhone ?? null,
        contactEmail: parsed.data.contactEmail || null,
      },
    });
    return NextResponse.json({ ok: true, data: institution }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
