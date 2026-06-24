import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileX, Lightbulb } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { submitAssessment } from "@/lib/actions";
import { PageHeader, EmptyState, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { SkillRadarChart } from "@/components/ui/charts";
import { fmtDate, titleCase } from "@/lib/utils";
import { TakeAssessment } from "../TakeAssessment";

type Option = { label: string; value: number };
type Question = { id: string; text: string; options: Option[] };

export default async function StudentAssessmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const instance = await prisma.studentAssessment.findUnique({
    where: { id },
    include: { template: true, student: true },
  });

  // Guard: this instance must belong to the logged-in student.
  if (!instance || instance.student.userId !== session.userId) {
    return (
      <>
        <Link href="/student/assessments" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy">
          <ArrowLeft className="h-4 w-4" /> Back to assessments
        </Link>
        <Panel>
          <EmptyState
            title="Assessment unavailable"
            hint="This assessment is not assigned to you, or does not exist."
            icon={<FileX className="h-8 w-8" />}
          />
        </Panel>
      </>
    );
  }

  // Completed -> show the result.
  if (instance.status === "COMPLETED") {
    const interpretation = (instance.interpretation as Record<string, number> | null) ?? {};
    const traits = Object.entries(interpretation);
    const radarData = traits.map(([trait, value]) => ({ axis: titleCase(trait), Score: value }));

    return (
      <>
        <Link href="/student/assessments" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy">
          <ArrowLeft className="h-4 w-4" /> Back to assessments
        </Link>

        <PageHeader
          title={instance.template.title}
          subtitle={`${titleCase(instance.template.category)}${instance.completedAt ? ` · Completed ${fmtDate(instance.completedAt)}` : ""}`}
          action={
            instance.score != null ? (
              <span className="rounded-xl bg-navy px-4 py-2 text-lg font-extrabold text-white">{instance.score}%</span>
            ) : undefined
          }
        />

        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Your Profile">
            {radarData.length >= 3 ? (
              <SkillRadarChart data={radarData} series={[{ key: "Score", label: "Result" }]} />
            ) : traits.length > 0 ? (
              <div className="space-y-3">
                {traits.map(([trait, value]) => (
                  <div key={trait}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <span className="font-medium text-slate-700">{titleCase(trait)}</span>
                      <span className="font-bold text-navy">{value}%</span>
                    </div>
                    <div className="progress">
                      <span style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: "#1E50A2" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState title="No detailed breakdown" hint="See your summary and recommendations." />
            )}
          </Panel>

          <Panel title="Summary & Recommendations">
            {instance.resultSummary && (
              <div className="rounded-lg bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
                {instance.resultSummary}
              </div>
            )}
            {instance.recommendations ? (
              <div className="mt-4 flex gap-3 rounded-lg border border-amber-100 bg-amber-50/60 p-4">
                <Lightbulb className="h-5 w-5 shrink-0 text-gold" />
                <p className="whitespace-pre-line text-sm text-slate-600">{instance.recommendations}</p>
              </div>
            ) : (
              !instance.resultSummary && <EmptyState title="No summary recorded" />
            )}
          </Panel>
        </div>
      </>
    );
  }

  // Not completed -> render the questionnaire.
  const questions = (instance.template.questions as Question[] | null) ?? [];

  return (
    <>
      <Link href="/student/assessments" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Back to assessments
      </Link>

      <PageHeader
        title={instance.template.title}
        subtitle={instance.template.description ?? titleCase(instance.template.category)}
        action={
          <Badge tone="blue">
            {instance.template.durationMins ? `${instance.template.durationMins} mins` : titleCase(instance.template.level)}
          </Badge>
        }
      />

      {questions.length === 0 ? (
        <Panel>
          <EmptyState title="No questions available" hint="This assessment has no questions configured yet." />
        </Panel>
      ) : (
        <TakeAssessment
          id={instance.id}
          title={instance.template.title}
          questions={questions}
          action={submitAssessment}
        />
      )}
    </>
  );
}
