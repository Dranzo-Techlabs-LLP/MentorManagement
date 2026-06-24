import { redirect } from "next/navigation";
import { FileBarChart } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, Avatar, EmptyState } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SkillRadarChart } from "@/components/ui/charts";
import { fmtDate, titleCase } from "@/lib/utils";

export default async function ParentAssessmentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const children = await prisma.student.findMany({
    where: { parentId: session.userId },
    select: { id: true },
  });
  const childIds = children.map((c) => c.id);

  const assessments = childIds.length
    ? await prisma.studentAssessment.findMany({
        where: { studentId: { in: childIds }, status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        include: { student: true, template: true },
      })
    : [];

  return (
    <>
      <PageHeader
        title="Assessments"
        subtitle="Completed aptitude & discovery assessments for your children"
      />

      {assessments.length === 0 ? (
        <Panel>
          <EmptyState
            title="No completed assessments"
            hint="Results appear here once your child completes an assessment."
            icon={<FileBarChart className="h-8 w-8" />}
          />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {assessments.map((a) => {
            const interpretation = (a.interpretation as Record<string, number> | null) ?? {};
            const traits = Object.entries(interpretation);
            const radarData = traits.map(([trait, value]) => ({ axis: titleCase(trait), Score: value }));
            return (
              <div key={a.id} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={a.student.fullName} src={a.student.photo} size={36} tint="#6d28d9" />
                    <div>
                      <p className="font-bold text-navy">{a.template.title}</p>
                      <p className="text-xs text-slate-400">
                        {a.student.fullName} · {titleCase(a.template.category)}
                        {a.completedAt ? ` · ${fmtDate(a.completedAt)}` : ""}
                      </p>
                    </div>
                  </div>
                  {a.score != null && (
                    <span className="rounded-lg bg-navy-50 px-3 py-1.5 text-sm font-extrabold text-navy">{a.score}%</span>
                  )}
                </div>

                {radarData.length >= 3 ? (
                  <div className="mt-3">
                    <SkillRadarChart data={radarData} series={[{ key: "Score", label: "Result", color: "#6d28d9" }]} height={240} />
                  </div>
                ) : traits.length > 0 ? (
                  <div className="mt-4 space-y-2.5">
                    {traits.map(([trait, value]) => (
                      <div key={trait}>
                        <div className="mb-1 flex items-center justify-between text-xs">
                          <span className="font-medium text-slate-600">{titleCase(trait)}</span>
                          <span className="font-semibold text-slate-500">{value}%</span>
                        </div>
                        <div className="progress">
                          <span style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: "#6d28d9" }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {a.resultSummary && (
                  <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">{a.resultSummary}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
