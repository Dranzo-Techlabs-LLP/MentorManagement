import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { TabLinks } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fmtDateTime, titleCase } from "@/lib/utils";

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
];

/** Mentoring sessions conducted by the supervisor's mentors. */
export default async function SupervisorSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { tab } = await searchParams;
  const view = tab ?? "upcoming";

  const mentorIds = (
    await prisma.user.findMany({
      where: { managerId: session.userId, role: "MENTOR" },
      select: { id: true },
    })
  ).map((m) => m.id);

  const base: Prisma.MentoringSessionWhereInput = {
    mentorId: { in: mentorIds.length ? mentorIds : ["__none__"] },
  };
  let where: Prisma.MentoringSessionWhereInput = base;
  let orderBy: Prisma.MentoringSessionOrderByWithRelationInput = { scheduledAt: "desc" };
  if (view === "upcoming") {
    where = { ...base, status: "SCHEDULED", scheduledAt: { gte: new Date() } };
    orderBy = { scheduledAt: "asc" };
  } else if (view === "completed") {
    where = { ...base, status: "COMPLETED" };
  }

  const sessions = await prisma.mentoringSession.findMany({
    where,
    orderBy,
    include: { mentor: true, _count: { select: { attendance: true } } },
  });

  return (
    <>
      <PageHeader title="Sessions" subtitle="Sessions run by your mentor team" />

      <TabLinks tabs={TABS} />

      <Panel>
        <DataTable
          rows={sessions}
          getKey={(s) => s.id}
          empty="No sessions in this view."
          columns={[
            {
              header: "Session",
              cell: (s) => (
                <div className="min-w-0">
                  <p className="font-semibold text-slate-700">{s.title}</p>
                  {s.topic && <p className="truncate text-xs text-slate-400">{s.topic}</p>}
                </div>
              ),
            },
            { header: "Mentor", cell: (s) => <span className="text-slate-600">{s.mentor.name}</span> },
            { header: "Type", cell: (s) => <Badge tone="teal">{titleCase(s.type)}</Badge> },
            { header: "Scheduled", cell: (s) => <span className="text-slate-600">{fmtDateTime(s.scheduledAt)}</span> },
            {
              header: "Attendees",
              cell: (s) => <span className="font-medium text-slate-600">{s._count.attendance}</span>,
            },
            { header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
          ]}
        />
      </Panel>
    </>
  );
}
