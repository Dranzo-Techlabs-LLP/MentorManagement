import { FileBarChart, ClipboardList, CheckCircle2, Percent } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { DonutChart } from "@/components/ui/charts";
import { CATEGORY_LABEL, titleCase } from "@/lib/utils";

/** Program-wide assessment analytics. */
export default async function ChiefAssessmentsPage() {
  const [templates, totalAssigned, statusCounts, completedByTemplate] = await Promise.all([
    prisma.assessmentTemplate.count(),
    prisma.studentAssessment.count(),
    prisma.studentAssessment.groupBy({ by: ["status"], _count: true }),
    prisma.studentAssessment.groupBy({
      by: ["templateId"],
      where: { status: "COMPLETED" },
      _count: true,
      _avg: { score: true },
    }),
  ]);

  const count = (s: string) => statusCounts.find((c) => c.status === s)?._count ?? 0;
  const completed = count("COMPLETED");
  const inProgress = count("IN_PROGRESS");
  const assigned = count("ASSIGNED");
  const total = completed + inProgress + assigned || 1;
  const completionPct = Math.round((completed / total) * 100);

  // template metadata for the grouped table
  const templateMeta = completedByTemplate.length
    ? await prisma.assessmentTemplate.findMany({
        where: { id: { in: completedByTemplate.map((g) => g.templateId) } },
        select: { id: true, title: true, level: true, category: true },
      })
    : [];
  const metaMap = new Map(templateMeta.map((t) => [t.id, t]));
  const grouped = completedByTemplate
    .map((g) => ({
      id: g.templateId,
      title: metaMap.get(g.templateId)?.title ?? "—",
      level: metaMap.get(g.templateId)?.level ?? "GENERAL",
      category: metaMap.get(g.templateId)?.category ?? null,
      completed: g._count,
      avgScore: g._avg.score != null ? Math.round(g._avg.score) : null,
    }))
    .sort((a, b) => b.completed - a.completed);

  return (
    <>
      <PageHeader title="Assessments" subtitle="Program-wide aptitude & psychometric analytics" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Templates" value={templates} icon={<FileBarChart className="h-5 w-5" />} tint="#1E50A2" />
        <StatCard label="Assigned" value={totalAssigned} icon={<ClipboardList className="h-5 w-5" />} tint="#E0A92E" />
        <StatCard label="Completed" value={completed} icon={<CheckCircle2 className="h-5 w-5" />} tint="#2FA84F" />
        <StatCard label="Completion %" value={`${completionPct}%`} icon={<Percent className="h-5 w-5" />} tint="#14A1A8" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
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

        <Panel title="Completed by Template" className="lg:col-span-2">
          <DataTable
            rows={grouped}
            getKey={(g) => g.id}
            empty="No completed assessments yet."
            columns={[
              { header: "Template", cell: (g) => <span className="font-semibold text-slate-700">{g.title}</span> },
              {
                header: "Level",
                cell: (g) => (
                  <span className="text-xs text-slate-500">
                    {g.level === "GENERAL" ? "General" : CATEGORY_LABEL[g.level] ?? titleCase(g.level)}
                  </span>
                ),
              },
              {
                header: "Category",
                cell: (g) => (g.category ? <Badge tone="purple">{titleCase(g.category)}</Badge> : <span className="text-slate-400">—</span>),
              },
              { header: "Completed", cell: (g) => <span className="font-medium text-slate-600">{g.completed}</span> },
              {
                header: "Avg Score",
                cell: (g) => <span className="font-bold text-navy">{g.avgScore != null ? `${g.avgScore}%` : "—"}</span>,
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
