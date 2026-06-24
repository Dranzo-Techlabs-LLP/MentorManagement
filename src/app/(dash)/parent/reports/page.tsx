import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, Avatar, EmptyState } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fmtDate, titleCase } from "@/lib/utils";

export default async function ParentReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const children = await prisma.student.findMany({
    where: { parentId: session.userId },
    select: { id: true },
  });
  const childIds = children.map((c) => c.id);

  const reports = childIds.length
    ? await prisma.progressReport.findMany({
        where: { studentId: { in: childIds }, sharedWithParent: true },
        orderBy: { updatedAt: "desc" },
        include: { student: true },
      })
    : [];

  return (
    <>
      <PageHeader title="Progress Reports" subtitle="Reports shared with you by your child's mentor" />

      <Panel>
        {reports.length === 0 ? (
          <EmptyState
            title="No reports shared yet"
            hint="When a mentor shares a progress report, it will appear here."
            icon={<FileText className="h-8 w-8" />}
          />
        ) : (
          <DataTable
            rows={reports}
            getKey={(r) => r.id}
            columns={[
              {
                header: "Child",
                cell: (r) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={r.student.fullName} src={r.student.photo} size={32} tint="#6d28d9" />
                    <span className="font-medium text-slate-700">{r.student.fullName}</span>
                  </div>
                ),
              },
              { header: "Report", cell: (r) => <span className="font-semibold text-navy">{r.title}</span> },
              { header: "Type", cell: (r) => titleCase(r.type) },
              { header: "Period", cell: (r) => r.period ?? "—" },
              { header: "Shared", cell: (r) => fmtDate(r.updatedAt) },
              { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
              {
                header: "",
                className: "text-right",
                cell: (r) => (
                  <Link href={`/parent/reports/${r.id}`} className="btn-outline text-xs">
                    View <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ),
              },
            ]}
          />
        )}
      </Panel>
    </>
  );
}
