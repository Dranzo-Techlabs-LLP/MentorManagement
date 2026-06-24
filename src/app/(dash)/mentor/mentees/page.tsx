import Link from "next/link";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, Avatar, Progress } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CATEGORY_LABEL } from "@/lib/utils";

export default async function MenteesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { q } = await searchParams;

  const where: Prisma.StudentWhereInput = {
    mentorId: session.userId,
    ...(q ? { fullName: { contains: q } } : {}),
  };

  const mentees = await prisma.student.findMany({
    where,
    orderBy: { fullName: "asc" },
    include: {
      growthRecords: { select: { score: true } },
      _count: { select: { assessments: true } },
    },
  });

  const withAvg = mentees.map((m) => {
    const scored = m.growthRecords.filter((r) => r.score != null);
    const avg = scored.length ? Math.round(scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length) : 0;
    return { ...m, avg };
  });

  return (
    <>
      <PageHeader
        title="My Mentees"
        subtitle={`${mentees.length} student${mentees.length === 1 ? "" : "s"} under your mentorship`}
        action={<SearchBar placeholder="Search mentees" />}
      />

      <Panel>
        <DataTable
          rows={withAvg}
          getKey={(s) => s.id}
          empty="No mentees found."
          columns={[
            {
              header: "Student",
              cell: (s) => (
                <Link href={`/mentor/mentees/${s.id}`} className="flex items-center gap-3 hover:opacity-80">
                  <Avatar name={s.fullName} src={s.photo} size={36} />
                  <div className="min-w-0">
                    <p className="font-semibold text-navy">{s.fullName}</p>
                    {s.rollNo && <p className="truncate text-xs text-slate-400">Roll {s.rollNo}</p>}
                  </div>
                </Link>
              ),
            },
            { header: "Class", cell: (s) => <span className="text-slate-600">{s.className ?? "—"}</span> },
            {
              header: "Level",
              cell: (s) => <span className="text-xs text-slate-500">{s.ageCategory ? CATEGORY_LABEL[s.ageCategory] : "—"}</span>,
            },
            {
              header: "Growth",
              cell: (s) => (
                <div className="flex w-40 items-center gap-2">
                  <Progress value={s.avg} />
                  <span className="shrink-0 text-xs font-semibold text-slate-500">{s.avg}%</span>
                </div>
              ),
            },
            { header: "Assessments", cell: (s) => <span className="font-medium text-slate-600">{s._count.assessments}</span> },
            { header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
          ]}
        />
      </Panel>
    </>
  );
}
