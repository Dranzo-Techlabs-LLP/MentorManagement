import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, Avatar, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatusBadge } from "@/components/ui/StatusBadge";

/** All mentors across the program. */
export default async function ChiefMentorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { q } = await searchParams;

  const where: Prisma.UserWhereInput = {
    role: "MENTOR",
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
  };

  const mentors = await prisma.user.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      manager: true,
      _count: { select: { studentsAsMentor: true, mentoredSessions: true } },
    },
  });

  const ratings = mentors.length
    ? await prisma.feedback.groupBy({
        by: ["mentorId"],
        where: { mentorId: { in: mentors.map((m) => m.id) }, rating: { not: null } },
        _avg: { rating: true },
      })
    : [];
  const ratingMap = new Map(ratings.map((r) => [r.mentorId, r._avg.rating ?? null]));

  return (
    <>
      <PageHeader
        title="Mentors"
        subtitle="All mentors across the program"
        action={<SearchBar placeholder="Search mentors" />}
      />

      <Panel>
        <DataTable
          rows={mentors}
          getKey={(m) => m.id}
          empty="No mentors found."
          columns={[
            {
              header: "Mentor",
              cell: (m) => (
                <div className="flex items-center gap-3">
                  <Avatar name={m.name} src={m.avatar} size={36} tint="#2FA84F" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-700">{m.name}</p>
                    <p className="truncate text-xs text-slate-400">{m.email}</p>
                  </div>
                </div>
              ),
            },
            { header: "Supervisor", cell: (m) => <span className="text-slate-600">{m.manager?.name ?? "—"}</span> },
            { header: "Mentees", cell: (m) => <Badge tone="blue">{m._count.studentsAsMentor}</Badge> },
            {
              header: "Rating",
              cell: (m) => {
                const r = ratingMap.get(m.id);
                return r != null ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-gold">
                    <Star className="h-3.5 w-3.5 fill-current" /> {r.toFixed(1)}
                  </span>
                ) : (
                  <span className="text-slate-400">—</span>
                );
              },
            },
            {
              header: "Sessions",
              cell: (m) => <span className="font-medium text-slate-600">{m._count.mentoredSessions}</span>,
            },
            { header: "Status", cell: (m) => <StatusBadge status={m.status} /> },
          ]}
        />
      </Panel>
    </>
  );
}
