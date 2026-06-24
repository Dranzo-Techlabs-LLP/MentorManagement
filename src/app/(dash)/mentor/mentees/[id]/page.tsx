import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  GraduationCap,
  Users,
  Building2,
  Mail,
  Phone,
  Plus,
  Trophy,
  Target,
  FileBarChart,
  FileText,
  CalendarDays,
  UserX,
} from "lucide-react";
import type { GrowthCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { addGrowthRecord, addAchievement, createGoal, assignAssessment, createReport } from "@/lib/actions";
import { PageHeader, Avatar, Badge, Progress, EmptyState } from "@/components/ui/primitives";
import { Panel, MiniMetric } from "@/components/dash/widgets";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton, Field } from "@/components/ui/form";
import { SkillRadarChart, CHART_COLORS } from "@/components/ui/charts";
import { ageFromDob, ageCategory, CATEGORY_LABEL, fmtDate, fmtDateTime, titleCase } from "@/lib/utils";

const GROWTH_CATEGORIES: GrowthCategory[] = [
  "ACADEMIC",
  "PERSONALITY",
  "LIFE_SKILLS",
  "MORAL_VALUE",
  "HEALTH_WELLBEING",
  "CAREER",
];

const REPORT_TYPES = ["MONTHLY", "QUARTERLY", "ANNUAL", "ASSESSMENT", "SESSION"];

export default async function MenteeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      parent: true,
      mentor: true,
      institution: true,
      growthRecords: { orderBy: { date: "desc" }, include: { recordedBy: true } },
      goals: { orderBy: { createdAt: "desc" } },
      achievements: { orderBy: { date: "desc" } },
      assessments: { orderBy: { createdAt: "desc" }, include: { template: true } },
      attendance: { orderBy: { session: { scheduledAt: "desc" } }, include: { session: true } },
      reports: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!student || student.mentorId !== session.userId) {
    return (
      <>
        <Link href="/mentor/mentees" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy">
          <ArrowLeft className="h-4 w-4" /> Back to mentees
        </Link>
        <Panel>
          <EmptyState title="Not your mentee" hint="This student is not assigned to you, or does not exist." icon={<UserX className="h-8 w-8" />} />
        </Panel>
      </>
    );
  }

  const templates = await prisma.assessmentTemplate.findMany({
    where: { isActive: true },
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  const age = ageFromDob(student.dob);
  const level = student.ageCategory ?? ageCategory(age);

  const catAverages = GROWTH_CATEGORIES.map((cat) => {
    const recs = student.growthRecords.filter((r) => r.category === cat && r.score != null);
    const avg = recs.length ? Math.round(recs.reduce((a, r) => a + (r.score ?? 0), 0) / recs.length) : 0;
    return { axis: titleCase(cat), score: avg };
  });
  const radarData = catAverages.map((c) => ({ axis: c.axis, Score: c.score }));
  const scored = catAverages.filter((c) => c.score > 0);
  const overallAvg = scored.length ? Math.round(scored.reduce((a, c) => a + c.score, 0) / scored.length) : 0;
  const completedGoals = student.goals.filter((g) => g.status === "COMPLETED").length;
  const recentSessions = student.attendance.slice(0, 6);

  return (
    <>
      <Link href="/mentor/mentees" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Back to mentees
      </Link>

      {/* Header */}
      <div className="card mb-5 p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={student.fullName} src={student.photo} size={88} />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-extrabold text-navy">{student.fullName}</h1>
              <StatusBadge status={student.status} />
              {level && <Badge tone="teal">{titleCase(level)}</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {student.className ?? "—"}
              {age != null && ` · Age ${age}`}
              {level && ` · ${CATEGORY_LABEL[level]}`}
            </p>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <InfoLine icon={<GraduationCap className="h-4 w-4" />} label="Mentor" value={student.mentor?.name ?? "—"} />
              <InfoLine icon={<Users className="h-4 w-4" />} label="Parent" value={student.parent?.name ?? "—"} />
              <InfoLine icon={<Building2 className="h-4 w-4" />} label="Institution" value={student.institution?.name ?? "—"} />
              <InfoLine icon={<Mail className="h-4 w-4" />} label="Email" value={student.email ?? "—"} />
              <InfoLine icon={<Phone className="h-4 w-4" />} label="Phone" value={student.phone ?? "—"} />
            </div>
          </div>
        </div>
      </div>

      <PageHeader
        title="Mentee Growth Portfolio"
        subtitle="Track development, goals, assessments & reports"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <AssignAssessmentModal studentId={student.id} templates={templates} />
            <CreateReportModal studentId={student.id} />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniMetric label="Overall Growth Index" value={`${overallAvg}%`} sub="Avg across 6 dimensions" />
        <MiniMetric label="Growth Records" value={student.growthRecords.length} sub="Logged observations" />
        <MiniMetric label="Goals" value={`${completedGoals}/${student.goals.length}`} sub="Completed / total" />
        <MiniMetric label="Achievements" value={student.achievements.length} sub="Milestones earned" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Skill Profile" action={<AddGrowthModal studentId={student.id} />}>
          {student.growthRecords.some((r) => r.score != null) ? (
            <SkillRadarChart data={radarData} series={[{ key: "Score", label: "Avg Score" }]} />
          ) : (
            <EmptyState title="No scored growth records yet" hint="Add a growth record with a score to build the skill profile." />
          )}
        </Panel>

        <Panel title="Goals" action={<CreateGoalModal studentId={student.id} />}>
          {student.goals.length === 0 ? (
            <EmptyState title="No goals set" hint="Set a development goal for this mentee." icon={<Target className="h-8 w-8" />} />
          ) : (
            <div className="space-y-4">
              {student.goals.map((g) => (
                <div key={g.id}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">{g.title}</p>
                    <StatusBadge status={g.status} />
                  </div>
                  {g.description && <p className="mb-1.5 text-xs text-slate-400">{g.description}</p>}
                  <Progress value={g.progress} />
                  <div className="mt-1 flex justify-between text-xs text-slate-400">
                    <span>{g.progress}% complete</span>
                    {g.targetDate && <span>Target {fmtDate(g.targetDate)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Recent Sessions">
          {recentSessions.length === 0 ? (
            <EmptyState title="No sessions yet" hint="Sessions this mentee attended will appear here." icon={<CalendarDays className="h-8 w-8" />} />
          ) : (
            <div className="divide-y divide-slate-50">
              {recentSessions.map((att) => (
                <div key={att.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">{att.session.title}</p>
                    <p className="text-xs text-slate-400">{fmtDateTime(att.session.scheduledAt)}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusBadge status={att.session.status} />
                    <StatusBadge status={att.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Achievements" action={<AddAchievementModal studentId={student.id} />}>
          {student.achievements.length === 0 ? (
            <EmptyState title="No achievements recorded" hint="Celebrate milestones as this mentee grows." icon={<Trophy className="h-8 w-8" />} />
          ) : (
            <div className="relative space-y-1 before:absolute before:bottom-2 before:left-[7px] before:top-2 before:w-px before:bg-slate-100">
              {student.achievements.map((a) => (
                <div key={a.id} className="relative flex gap-3 py-2 pl-0">
                  <span className="relative z-10 mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold/20">
                    <Trophy className="h-2.5 w-2.5 text-gold" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-700">{a.title}</p>
                    {a.description && <p className="text-xs text-slate-400">{a.description}</p>}
                    <p className="mt-0.5 text-xs text-slate-400">
                      {a.category ? `${a.category} · ` : ""}
                      {fmtDate(a.date)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Assessments">
          {student.assessments.length === 0 ? (
            <EmptyState title="No assessments assigned" hint="Assign an assessment from the buttons above." icon={<FileBarChart className="h-8 w-8" />} />
          ) : (
            <div className="divide-y divide-slate-50">
              {student.assessments.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">{a.template.title}</p>
                    <p className="text-xs text-slate-400">
                      {titleCase(a.template.category)}
                      {a.completedAt ? ` · ${fmtDate(a.completedAt)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {a.score != null && <span className="text-sm font-bold text-navy">{a.score}%</span>}
                    <StatusBadge status={a.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Progress Reports" action={<CreateReportModal studentId={student.id} />}>
          {student.reports.length === 0 ? (
            <EmptyState title="No reports yet" hint="Create a progress report for this mentee." icon={<FileText className="h-8 w-8" />} />
          ) : (
            <div className="divide-y divide-slate-50">
              {student.reports.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">{r.title}</p>
                    <p className="text-xs text-slate-400">
                      {titleCase(r.type)}
                      {r.period ? ` · ${r.period}` : ""} · {fmtDate(r.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Growth records grouped */}
      <div className="mt-4">
        <Panel title="Growth Records" action={<AddGrowthModal studentId={student.id} />}>
          {student.growthRecords.length === 0 ? (
            <EmptyState title="No growth records yet" hint="Log observations across the six growth dimensions." />
          ) : (
            <div className="space-y-5">
              {GROWTH_CATEGORIES.map((cat) => {
                const records = student.growthRecords.filter((r) => r.category === cat);
                if (records.length === 0) return null;
                const idx = GROWTH_CATEGORIES.indexOf(cat);
                const color = CHART_COLORS[idx % CHART_COLORS.length];
                return (
                  <div key={cat}>
                    <div className="mb-2 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                      <h4 className="text-sm font-bold text-navy">{titleCase(cat)}</h4>
                      <span className="text-xs text-slate-400">({records.length})</span>
                    </div>
                    <div className="divide-y divide-slate-50 border-l-2 pl-4" style={{ borderColor: `${color}40` }}>
                      {records.map((r) => (
                        <div key={r.id} className="flex items-start justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-700">{r.title}</p>
                            {r.note && <p className="text-xs text-slate-400">{r.note}</p>}
                            <p className="mt-0.5 text-xs text-slate-400">
                              {fmtDate(r.date)}
                              {r.recordedBy && ` · ${r.recordedBy.name}`}
                            </p>
                          </div>
                          {r.score != null && (
                            <span className="shrink-0 rounded-lg bg-slate-50 px-2.5 py-1 text-sm font-bold text-navy">{r.score}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function InfoLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <span className="text-slate-400">{label}:</span>
      <span className="truncate font-medium text-slate-700">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MODALS
// ---------------------------------------------------------------------------
function AddGrowthModal({ studentId }: { studentId: string }) {
  return (
    <Modal
      title="Add Growth Record"
      triggerClassName="btn-outline text-xs"
      triggerLabel={<><Plus className="h-3.5 w-3.5" /> Add</>}
    >
      <ActionForm action={addGrowthRecord} className="space-y-4">
          <input type="hidden" name="studentId" value={studentId} />
          <Field label="Category">
            <select name="category" className="input" required defaultValue="ACADEMIC">
              {GROWTH_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {titleCase(c)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input name="title" className="input" required placeholder="e.g. Strong improvement in algebra" />
          </Field>
          <Field label="Note">
            <textarea name="note" className="input" rows={3} placeholder="Observation details…" />
          </Field>
          <Field label="Score (0–100)" hint="Optional. Used in the skill profile radar.">
            <input name="score" type="number" min={0} max={100} className="input" placeholder="75" />
          </Field>
          <div className="flex justify-end">
            <SubmitButton>Add record</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}

function CreateGoalModal({ studentId }: { studentId: string }) {
  return (
    <Modal
      title="Add Goal"
      triggerClassName="btn-outline text-xs"
      triggerLabel={<><Target className="h-3.5 w-3.5" /> Add</>}
    >
      <ActionForm action={createGoal} className="space-y-4">
          <input type="hidden" name="studentId" value={studentId} />
          <Field label="Goal title">
            <input name="title" className="input" required placeholder="e.g. Read 12 books this year" />
          </Field>
          <Field label="Description">
            <textarea name="description" className="input" rows={3} placeholder="Details…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <select name="category" className="input" defaultValue="">
                <option value="">— None —</option>
                {GROWTH_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {titleCase(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Target date">
              <input name="targetDate" type="date" className="input" />
            </Field>
          </div>
          <Field label="Initial progress (%)">
            <input name="progress" type="number" min={0} max={100} className="input" defaultValue={0} />
          </Field>
          <div className="flex justify-end">
            <SubmitButton>Create goal</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}

function AddAchievementModal({ studentId }: { studentId: string }) {
  return (
    <Modal
      title="Add Achievement"
      triggerClassName="btn-outline text-xs"
      triggerLabel={<><Trophy className="h-3.5 w-3.5" /> Add</>}
    >
      <ActionForm action={addAchievement} className="space-y-4">
          <input type="hidden" name="studentId" value={studentId} />
          <Field label="Title">
            <input name="title" className="input" required placeholder="e.g. Won district debate" />
          </Field>
          <Field label="Category">
            <input name="category" className="input" placeholder="Leadership, Academic, Sports…" />
          </Field>
          <Field label="Description">
            <textarea name="description" className="input" rows={3} placeholder="Details…" />
          </Field>
          <div className="flex justify-end">
            <SubmitButton>Add achievement</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}

function AssignAssessmentModal({
  studentId,
  templates,
}: {
  studentId: string;
  templates: { id: string; title: string }[];
}) {
  return (
    <Modal
      title="Assign Assessment"
      triggerClassName="btn-outline"
      triggerLabel={<><FileBarChart className="h-4 w-4" /> Assign Assessment</>}
    >
      <ActionForm action={assignAssessment} className="space-y-4">
          <input type="hidden" name="studentId" value={studentId} />
          <Field label="Assessment template">
            <select name="templateId" className="input" required defaultValue="">
              <option value="" disabled>
                Select a template…
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end">
            <SubmitButton>Assign</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}

function CreateReportModal({ studentId }: { studentId: string }) {
  return (
    <Modal
      wide
      title="Create Progress Report"
      triggerClassName="btn-primary"
      triggerLabel={<><FileText className="h-4 w-4" /> Create Report</>}
    >
      <ActionForm action={createReport} className="space-y-4">
          <input type="hidden" name="studentId" value={studentId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title">
              <input name="title" className="input" required placeholder="e.g. June Monthly Report" />
            </Field>
            <Field label="Type">
              <select name="type" className="input" defaultValue="MONTHLY">
                {REPORT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {titleCase(t)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Period">
            <input name="period" className="input" placeholder="e.g. June 2026 / Q2 2026" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Academic">
              <input name="academic" type="number" min={0} max={100} className="input" defaultValue={0} />
            </Field>
            <Field label="Leadership">
              <input name="leadership" type="number" min={0} max={100} className="input" defaultValue={0} />
            </Field>
            <Field label="Character">
              <input name="character" type="number" min={0} max={100} className="input" defaultValue={0} />
            </Field>
            <Field label="Life Skills">
              <input name="lifeSkills" type="number" min={0} max={100} className="input" defaultValue={0} />
            </Field>
            <Field label="Spiritual">
              <input name="spiritual" type="number" min={0} max={100} className="input" defaultValue={0} />
            </Field>
          </div>
          <Field label="Summary">
            <textarea name="summary" className="input" rows={4} placeholder="Narrative summary of progress…" />
          </Field>
          <Field label="Status">
            <select name="status" className="input" defaultValue="PENDING">
              <option value="DRAFT">Save as Draft</option>
              <option value="PENDING">Submit for Review</option>
            </select>
          </Field>
          <div className="flex justify-end">
            <SubmitButton>Save report</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}
