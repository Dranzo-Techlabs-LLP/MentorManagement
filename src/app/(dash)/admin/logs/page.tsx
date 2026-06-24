import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { fmtDateTime, titleCase } from "@/lib/utils";

const ACTION_TONE: Record<string, "green" | "blue" | "gold" | "red" | "slate" | "purple" | "teal"> = {
  CREATE: "green",
  UPDATE: "blue",
  DELETE: "red",
  APPROVE: "green",
  REJECT: "red",
  REVIEW: "teal",
  COMPLETE: "purple",
};

export default async function LogsPage() {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: true },
  });

  return (
    <>
      <PageHeader title="System Logs" subtitle="Audit trail · latest 100 events" />

      <Panel>
        <DataTable
          rows={logs}
          getKey={(l) => l.id}
          empty="No audit events recorded."
          columns={[
            {
              header: "Action",
              cell: (l) => <Badge tone={ACTION_TONE[l.action] ?? "slate"}>{titleCase(l.action)}</Badge>,
            },
            { header: "Entity", cell: (l) => <span className="font-medium text-slate-600">{l.entity ?? "—"}</span> },
            {
              header: "Entity ID",
              cell: (l) => <span className="font-mono text-xs text-slate-400">{l.entityId ?? "—"}</span>,
            },
            { header: "User", cell: (l) => <span className="text-slate-600">{l.user?.name ?? "System"}</span> },
            { header: "Timestamp", cell: (l) => <span className="text-slate-500">{fmtDateTime(l.createdAt)}</span> },
          ]}
        />
      </Panel>
    </>
  );
}
