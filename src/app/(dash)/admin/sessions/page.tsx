import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
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

export default async function SessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const view = tab ?? "upcoming";

  let where: Prisma.MentoringSessionWhereInput = {};
  let orderBy: Prisma.MentoringSessionOrderByWithRelationInput = { scheduledAt: "desc" };
  if (view === "upcoming") {
    where = { status: "SCHEDULED", scheduledAt: { gte: new Date() } };
    orderBy = { scheduledAt: "asc" };
  } else if (view === "completed") {
    where = { status: "COMPLETED" };
  }

  const sessions = await prisma.mentoringSession.findMany({
    where,
    orderBy,
    include: { mentor: true, _count: { select: { attendance: true } } },
  });

  return (
    <>
      <PageHeader title="Mentoring Sessions" subtitle="Program-wide schedule of one-to-one and group sessions" />

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
