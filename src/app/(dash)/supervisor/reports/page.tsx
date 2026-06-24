import { redirect } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import type { Prisma, ReportStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { reviewReport } from "@/lib/actions";
import { PageHeader, Avatar } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { TabLinks } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/form";
import { titleCase } from "@/lib/utils";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "reviewed", label: "Reviewed" },
  { key: "all", label: "All" },
];

const TAB_STATUS: Record<string, ReportStatus | undefined> = {
  pending: "PENDING",
  reviewed: "REVIEWED",
  all: undefined,
};

/** Progress reports submitted by the supervisor's mentors. */
export default async function SupervisorReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { tab } = await searchParams;
  const status = TAB_STATUS[tab ?? "pending"];

  const mentorIds = (
    await prisma.user.findMany({
      where: { managerId: session.userId, role: "MENTOR" },
      select: { id: true },
    })
  ).map((m) => m.id);

  const where: Prisma.ProgressReportWhereInput = {
    submittedById: { in: mentorIds.length ? mentorIds : ["__none__"] },
    ...(status ? { status } : {}),
  };

  const reports = await prisma.progressReport.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { student: true, submittedBy: true },
  });

  return (
    <>
      <PageHeader title="Reports Review" subtitle="Progress reports submitted by your mentors" />

      <TabLinks tabs={TABS} />

      <Panel>
        <DataTable
          rows={reports}
          getKey={(r) => r.id}
          empty="No reports in this view."
          columns={[
            {
              header: "Student",
              cell: (r) => (
                <div className="flex items-center gap-3">
                  <Avatar name={r.student.fullName} src={r.student.photo} size={32} />
                  <span className="font-semibold text-slate-700">{r.student.fullName}</span>
                </div>
              ),
            },
            { header: "Mentor", cell: (r) => <span className="text-slate-600">{r.submittedBy?.name ?? "—"}</span> },
            { header: "Title", cell: (r) => <span className="text-slate-600">{r.title}</span> },
            { header: "Type", cell: (r) => <span className="font-medium text-slate-600">{titleCase(r.type)}</span> },
            { header: "Period", cell: (r) => <span className="text-slate-600">{r.period ?? "—"}</span> },
            { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            {
              header: "Actions",
              cell: (r) =>
                r.status === "PENDING" ? (
                  <ActionForm action={reviewReport} className="inline-flex">
                    <input type="hidden" name="id" value={r.id} />
                    <SubmitButton className="btn-green text-xs" pendingText="…">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Review
                    </SubmitButton>
                  </ActionForm>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                ),
            },
          ]}
        />
      </Panel>
    </>
  );
}
