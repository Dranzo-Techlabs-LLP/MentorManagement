import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, Avatar } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { DonutChart } from "@/components/ui/charts";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fmtDate } from "@/lib/utils";

/** Assessment overview for the students mentored by this supervisor's team. */
export default async function SupervisorAssessmentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const mentorIds = (
    await prisma.user.findMany({
      where: { managerId: session.userId, role: "MENTOR" },
      select: { id: true },
    })
  ).map((m) => m.id);

  const studentIds = mentorIds.length
    ? (
        await prisma.student.findMany({
          where: { mentorId: { in: mentorIds } },
          select: { id: true },
        })
      ).map((s) => s.id)
    : [];

  const studentFilter = { in: studentIds.length ? studentIds : ["__none__"] };

  const [statusCounts, recent] = await Promise.all([
    prisma.studentAssessment.groupBy({
      by: ["status"],
      where: { studentId: studentFilter },
      _count: true,
    }),
    prisma.studentAssessment.findMany({
      where: { studentId: studentFilter },
      orderBy: { createdAt: "desc" },
      take: 12,
      include: { student: true, template: true },
    }),
  ]);

  const count = (s: string) => statusCounts.find((c) => c.status === s)?._count ?? 0;
  const completed = count("COMPLETED");
  const inProgress = count("IN_PROGRESS");
  const assigned = count("ASSIGNED");
  const total = completed + inProgress + assigned || 1;
  const completionPct = Math.round((completed / total) * 100);

  return (
    <>
      <PageHeader title="Assessments" subtitle="Aptitude & psychometric assessments for your students" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Assessment Status">
          <DonutChart
            centerLabel={`${completionPct}%`}
            data={[
              { name: "Completed", value: completed || 1, color: "#2FA84F" },
              { name: "In Progress", value: inProgress, color: "#14A1A8" },
              { name: "Assigned", value: assigned, color: "#E0A92E" },
            ]}
          />
          <div className="mt-3 space-y-1.5 text-sm">
            <Legend color="#2FA84F" label="Completed" value={completed} />
            <Legend color="#14A1A8" label="In Progress" value={inProgress} />
            <Legend color="#E0A92E" label="Assigned" value={assigned} />
          </div>
        </Panel>

        <Panel title="Recent Assessments" className="lg:col-span-2">
          <DataTable
            rows={recent}
            getKey={(a) => a.id}
            empty="No assessments for your students yet."
            columns={[
              {
                header: "Student",
                cell: (a) => (
                  <div className="flex items-center gap-3">
                    <Avatar name={a.student.fullName} src={a.student.photo} size={32} />
                    <span className="font-semibold text-slate-700">{a.student.fullName}</span>
                  </div>
                ),
              },
              { header: "Template", cell: (a) => <span className="text-slate-600">{a.template.title}</span> },
              { header: "Status", cell: (a) => <StatusBadge status={a.status} /> },
              {
                header: "Score",
                cell: (a) => <span className="font-bold text-navy">{a.score != null ? `${a.score}%` : "—"}</span>,
              },
              {
                header: "Completed",
                cell: (a) => <span className="text-slate-500">{a.completedAt ? fmtDate(a.completedAt) : "—"}</span>,
              },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-slate-600">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {label}
      </span>
      <span className="font-semibold text-slate-700">{value}</span>
    </div>
  );
}
