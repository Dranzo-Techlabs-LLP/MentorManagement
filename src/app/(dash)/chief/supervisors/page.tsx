import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, Avatar, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatusBadge } from "@/components/ui/StatusBadge";

/** All supervisors with their team size and the students their teams mentor. */
export default async function ChiefSupervisorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { q } = await searchParams;

  const where: Prisma.UserWhereInput = {
    role: "SUPERVISOR",
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
  };

  const supervisors = await prisma.user.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      institution: true,
      // mentors that report to this supervisor
      reports: { where: { role: "MENTOR" }, select: { id: true } },
    },
  });

  // students mentored by each supervisor's mentor team
  const allMentorIds = supervisors.flatMap((s) => s.reports.map((m) => m.id));
  const studentsByMentor = allMentorIds.length
    ? await prisma.student.groupBy({
        by: ["mentorId"],
        where: { mentorId: { in: allMentorIds } },
        _count: true,
      })
    : [];
  const studentCountByMentor = new Map(studentsByMentor.map((g) => [g.mentorId, g._count]));
  const studentsForSupervisor = (mentorIds: string[]) =>
    mentorIds.reduce((sum, id) => sum + (studentCountByMentor.get(id) ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Supervisors"
        subtitle="Supervisors and the mentor teams they lead"
        action={<SearchBar placeholder="Search supervisors" />}
      />

      <Panel>
        <DataTable
          rows={supervisors}
          getKey={(s) => s.id}
          empty="No supervisors found."
          columns={[
            {
              header: "Supervisor",
              cell: (s) => (
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} src={s.avatar} size={36} tint="#E0A92E" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-700">{s.name}</p>
                    <p className="truncate text-xs text-slate-400">{s.email}</p>
                  </div>
                </div>
              ),
            },
            { header: "Institution", cell: (s) => <span className="text-slate-600">{s.institution?.name ?? "—"}</span> },
            { header: "Team Size", cell: (s) => <Badge tone="green">{s.reports.length}</Badge> },
            {
              header: "Students",
              cell: (s) => (
                <Badge tone="blue">{studentsForSupervisor(s.reports.map((m) => m.id))}</Badge>
              ),
            },
            { header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
          ]}
        />
      </Panel>
    </>
  );
}
