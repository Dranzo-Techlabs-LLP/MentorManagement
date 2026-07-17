import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { apiError } from "@/lib/api-helpers";
import type { Prisma } from "@prisma/client";

const DEFAULT_PAGE_SIZE = 20;

// GET /api/announcements?page=&pageSize=
export async function GET(req: NextRequest) {
  try {
    await requirePermission("announcements", "view");
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize")) || DEFAULT_PAGE_SIZE));

    const [items, total] = await Promise.all([
      prisma.announcement.findMany({
        orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * pageSize, take: pageSize,
        include: { author: { select: { id: true, name: true } } },
      }),
      prisma.announcement.count(),
    ]);
    return NextResponse.json({ ok: true, data: items, page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) });
  } catch (e) {
    return apiError(e);
  }
}

// POST /api/announcements
export async function POST(req: NextRequest) {
  try {
    const sess = await requirePermission("announcements", "create");
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return NextResponse.json({ ok: false, error: "Invalid JSON body." }, { status: 400 });
    if (!body.title || !body.body) return NextResponse.json({ ok: false, error: "Title and body are required." }, { status: 422 });

    const announcement = await prisma.announcement.create({
      data: {
        authorId: sess.userId, title: body.title, body: body.body,
        audience: (body.audience || "ALL") as Prisma.AnnouncementCreateInput["audience"],
        institutionId: body.institutionId || null, pinned: !!body.pinned,
      },
    });
    const actor = await getSession();
    await prisma.auditLog.create({
      data: { userId: actor?.userId, action: "CREATE", entity: "Announcement", entityId: announcement.id },
    }).catch(() => {});
    return NextResponse.json({ ok: true, data: announcement }, { status: 201 });
  } catch (e) {
    return apiError(e);
  }
}
