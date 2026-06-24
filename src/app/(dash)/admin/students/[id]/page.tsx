import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Mail,
  Phone,
  MapPin,
  GraduationCap,
  Users,
  Building2,
  Plus,
  Trophy,
  Target,
  FileText,
  CalendarDays,
  FolderOpen,
} from "lucide-react";
import type { GrowthCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { addGrowthRecord, addAchievement, createGoal, addDocument } from "@/lib/actions";
import { PageHeader, Avatar, Badge, Progress, EmptyState } from "@/components/ui/primitives";
import { Panel, MiniMetric, ActivityItem } from "@/components/dash/widgets";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TabLinks } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton, Field } from "@/components/ui/form";
import { SkillRadarChart, GroupBarChart, CHART_COLORS } from "@/components/ui/charts";
import { ageFromDob, ageCategory, CATEGORY_LABEL, fmtDate, fmtDateTime, titleCase } from "@/lib/utils";

const GROWTH_CATEGORIES: GrowthCategory[] = [
  "ACADEMIC",
  "PERSONALITY",
  "LIFE_SKILLS",
  "MORAL_VALUE",
  "HEALTH_WELLBEING",
  "CAREER",
];

const TABS = [
  { key: "profile", label: "Profile" },
  { key: "portfolio", label: "Growth Portfolio" },
  { key: "assessments", label: "Assessments" },
  { key: "sessions", label: "Sessions" },
  { key: "reports", label: "Reports" },
  { key: "documents", label: "Documents" },
];

export default async function StudentProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const active = tab ?? "profile";

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      parent: true,
      mentor: true,
      institution: true,
      growthRecords: { orderBy: { date: "desc" }, include: { recordedBy: true } },
      goals: { orderBy: { createdAt: "desc" } },
      achievements: { orderBy: { date: "desc" } },
      documents: { orderBy: { createdAt: "desc" }, include: { uploadedBy: true } },
      assessments: { orderBy: { createdAt: "desc" }, include: { template: true } },
      attendance: { orderBy: { session: { scheduledAt: "desc" } }, include: { session: true } },
      reports: { orderBy: { createdAt: "desc" } },
    },
  });

  if (!student) notFound();

  const age = ageFromDob(student.dob);
  const level = student.ageCategory ?? ageCategory(age);

  // radar: average growth score per category
  const catAverages = GROWTH_CATEGORIES.map((cat) => {
    const recs = student.growthRecords.filter((r) => r.category === cat && r.score != null);
    const avg = recs.length ? Math.round(recs.reduce((a, r) => a + (r.score ?? 0), 0) / recs.length) : 0;
    return { axis: titleCase(cat), score: avg };
  });
  const radarData = catAverages.map((c) => ({ axis: c.axis, Score: c.score }));
  const overallAvg = catAverages.filter((c) => c.score > 0).length
    ? Math.round(
        catAverages.filter((c) => c.score > 0).reduce((a, c) => a + c.score, 0) /
          catAverages.filter((c) => c.score > 0).length,
      )
    : 0;

  const completedGoals = student.goals.filter((g) => g.status === "COMPLETED").length;

  return (
    <>
      <Link href="/admin/students" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Back to students
      </Link>

      {/* Header master card */}
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
              {student.rollNo && ` · Roll ${student.rollNo}`}
              {level && ` · ${CATEGORY_LABEL[level]}`}
            </p>

            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <InfoLine icon={<GraduationCap className="h-4 w-4" />} label="Mentor" value={student.mentor?.name ?? "Unassigned"} />
              <InfoLine icon={<Users className="h-4 w-4" />} label="Parent" value={student.parent?.name ?? "—"} />
              <InfoLine icon={<Building2 className="h-4 w-4" />} label="Institution" value={student.institution?.name ?? "—"} />
              <InfoLine icon={<Mail className="h-4 w-4" />} label="Email" value={student.email ?? "—"} />
              <InfoLine icon={<Phone className="h-4 w-4" />} label="Phone" value={student.phone ?? "—"} />
              <InfoLine icon={<MapPin className="h-4 w-4" />} label="Address" value={student.address ?? "—"} />
            </div>
          </div>
        </div>
      </div>

      <PageHeader title="Student Master Profile" subtitle="Digital growth portfolio & program records" />

      <TabLinks tabs={TABS} />

      {active === "profile" && <ProfileTab student={student} age={age} level={level} />}
      {active === "portfolio" && (
        <PortfolioTab
          student={student}
          radarData={radarData}
          catAverages={catAverages}
          overallAvg={overallAvg}
          completedGoals={completedGoals}
        />
      )}
      {active === "assessments" && <AssessmentsTab assessments={student.assessments} />}
      {active === "sessions" && <SessionsTab attendance={student.attendance} />}
      {active === "reports" && <ReportsTab reports={student.reports} />}
      {active === "documents" && <DocumentsTab studentId={student.id} documents={student.documents} />}
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
// PROFILE
// ---------------------------------------------------------------------------
function ProfileTab({
  student,
  age,
  level,
}: {
  student: { gender: string | null; dob: Date | null; className: string | null; rollNo: string | null; admissionDate: Date; interests: string | null; talents: string | null; notes: string | null };
  age: number | null;
  level: string | null;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Panel title="Personal Details" className="lg:col-span-2">
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Detail label="Gender" value={student.gender ?? "—"} />
          <Detail label="Date of birth" value={fmtDate(student.dob)} />
          <Detail label="Age" value={age != null ? `${age} years` : "—"} />
          <Detail label="Age category" value={level ? CATEGORY_LABEL[level] : "—"} />
          <Detail label="Class / Grade" value={student.className ?? "—"} />
          <Detail label="Roll number" value={student.rollNo ?? "—"} />
          <Detail label="Admission date" value={fmtDate(student.admissionDate)} />
        </div>
        {student.notes && (
          <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            <p className="mb-1 font-semibold text-slate-500">Notes</p>
            {student.notes}
          </div>
        )}
      </Panel>

      <div className="space-y-4">
        <Panel title="Interests">
          {student.interests ? (
            <div className="flex flex-wrap gap-2">
              {student.interests.split(",").map((t, i) => (
                <Badge key={i} tone="blue">
                  {t.trim()}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No interests recorded.</p>
          )}
        </Panel>
        <Panel title="Talents">
          {student.talents ? (
            <div className="flex flex-wrap gap-2">
              {student.talents.split(",").map((t, i) => (
                <Badge key={i} tone="green">
                  {t.trim()}
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No talents recorded.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-0.5 font-medium text-slate-700">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PORTFOLIO
// ---------------------------------------------------------------------------
function PortfolioTab({
  student,
  radarData,
  catAverages,
  overallAvg,
  completedGoals,
}: {
  student: {
    id: string;
    goals: { id: string; title: string; description: string | null; progress: number; status: string; targetDate: Date | null }[];
    achievements: { id: string; title: string; description: string | null; category: string | null; date: Date }[];
    growthRecords: { id: string; category: string; title: string; note: string | null; score: number | null; date: Date; recordedBy: { name: string } | null }[];
  };
  radarData: { axis: string; Score: number }[];
  catAverages: { axis: string; score: number }[];
  overallAvg: number;
  completedGoals: number;
}) {
  // group growth records by category
  const grouped = GROWTH_CATEGORIES.map((cat) => ({
    category: cat,
    records: student.growthRecords.filter((r) => r.category === cat),
  })).filter((g) => g.records.length > 0);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniMetric label="Overall Growth Index" value={`${overallAvg}%`} sub="Avg across 6 dimensions" />
        <MiniMetric label="Growth Records" value={student.growthRecords.length} sub="Logged observations" />
        <MiniMetric label="Goals" value={`${completedGoals}/${student.goals.length}`} sub="Completed / total" />
        <MiniMetric label="Achievements" value={student.achievements.length} sub="Milestones earned" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title="Skill Profile"
          action={
            <AddGrowthModal studentId={student.id} />
          }
        >
          {student.growthRecords.some((r) => r.score != null) ? (
            <SkillRadarChart data={radarData} series={[{ key: "Score", label: "Avg Score" }]} />
          ) : (
            <EmptyState title="No scored growth records yet" hint="Add a growth record with a score to build the skill profile." />
          )}
        </Panel>

        <Panel title="Dimension Averages">
          <GroupBarChart
            data={catAverages.map((c) => ({ name: c.axis, Score: c.score }))}
            series={[{ key: "Score", label: "Average score" }]}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Goals" action={<CreateGoalModal studentId={student.id} />}>
          {student.goals.length === 0 ? (
            <p className="text-sm text-slate-400">No goals set.</p>
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

        <Panel title="Achievements" action={<AddAchievementModal studentId={student.id} />}>
          {student.achievements.length === 0 ? (
            <p className="text-sm text-slate-400">No achievements recorded.</p>
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

      <Panel title="Growth Records" action={<AddGrowthModal studentId={student.id} />}>
        {grouped.length === 0 ? (
          <EmptyState title="No growth records yet" hint="Log observations across the six growth dimensions." />
        ) : (
          <div className="space-y-5">
            {grouped.map((group) => {
              const idx = GROWTH_CATEGORIES.indexOf(group.category as GrowthCategory);
              const color = CHART_COLORS[idx % CHART_COLORS.length];
              return (
                <div key={group.category}>
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                    <h4 className="text-sm font-bold text-navy">{titleCase(group.category)}</h4>
                    <span className="text-xs text-slate-400">({group.records.length})</span>
                  </div>
                  <div className="divide-y divide-slate-50 border-l-2 pl-4" style={{ borderColor: `${color}40` }}>
                    {group.records.map((r) => (
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
                          <span className="shrink-0 rounded-lg bg-slate-50 px-2.5 py-1 text-sm font-bold text-navy">
                            {r.score}
                          </span>
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
  );
}

// ---------------------------------------------------------------------------
// ASSESSMENTS
// ---------------------------------------------------------------------------
function AssessmentsTab({
  assessments,
}: {
  assessments: {
    id: string;
    status: string;
    score: number | null;
    resultSummary: string | null;
    interpretation: unknown;
    completedAt: Date | null;
    template: { title: string; category: string };
  }[];
}) {
  if (assessments.length === 0) {
    return (
      <Panel>
        <EmptyState title="No assessments assigned" hint="Assessments assigned to this student will appear here." />
      </Panel>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {assessments.map((a) => {
        const interp =
          a.interpretation && typeof a.interpretation === "object" && !Array.isArray(a.interpretation)
            ? (a.interpretation as Record<string, number>)
            : null;
        const bars = interp ? Object.entries(interp).sort((x, y) => y[1] - x[1]) : [];
        return (
          <Panel key={a.id} title={a.template.title} action={<StatusBadge status={a.status} />}>
            <div className="mb-3 flex items-center gap-3 text-sm">
              <Badge tone="purple">{titleCase(a.template.category)}</Badge>
              {a.score != null && (
                <span className="font-bold text-navy">Score: {a.score}%</span>
              )}
              {a.completedAt && <span className="text-slate-400">{fmtDate(a.completedAt)}</span>}
            </div>
            {a.resultSummary && <p className="mb-3 text-sm text-slate-600">{a.resultSummary}</p>}
            {a.status === "COMPLETED" && bars.length > 0 ? (
              <div className="space-y-2">
                {bars.map(([trait, val]) => (
                  <div key={trait}>
                    <div className="mb-0.5 flex justify-between text-xs">
                      <span className="font-medium text-slate-600">{titleCase(trait)}</span>
                      <span className="text-slate-400">{val}%</span>
                    </div>
                    <Progress value={val} color="#6d28d9" />
                  </div>
                ))}
              </div>
            ) : a.status !== "COMPLETED" ? (
              <p className="text-sm text-slate-400">Awaiting completion.</p>
            ) : null}
          </Panel>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SESSIONS
// ---------------------------------------------------------------------------
function SessionsTab({
  attendance,
}: {
  attendance: {
    id: string;
    status: string;
    note: string | null;
    session: { title: string; topic: string | null; scheduledAt: Date; status: string };
  }[];
}) {
  return (
    <Panel title="Session Attendance">
      {attendance.length === 0 ? (
        <EmptyState title="No sessions yet" hint="Mentoring sessions this student attended will be listed here." icon={<CalendarDays className="h-8 w-8" />} />
      ) : (
        <div className="divide-y divide-slate-50">
          {attendance.map((att) => (
            <div key={att.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700">{att.session.title}</p>
                <p className="truncate text-xs text-slate-400">
                  {att.session.topic ? `${att.session.topic} · ` : ""}
                  {fmtDateTime(att.session.scheduledAt)}
                </p>
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
  );
}

// ---------------------------------------------------------------------------
// REPORTS
// ---------------------------------------------------------------------------
function ReportsTab({
  reports,
}: {
  reports: { id: string; title: string; type: string; period: string | null; status: string; createdAt: Date }[];
}) {
  return (
    <Panel title="Progress Reports">
      {reports.length === 0 ? (
        <EmptyState title="No reports yet" hint="Progress reports for this student will appear here." icon={<FileText className="h-8 w-8" />} />
      ) : (
        <div className="divide-y divide-slate-50">
          {reports.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-700">{r.title}</p>
                <p className="text-xs text-slate-400">
                  {titleCase(r.type)}
                  {r.period ? ` · ${r.period}` : ""} · {fmtDate(r.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={r.status} />
                <Link href="/admin/reports" className="btn-ghost text-xs">
                  View
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// DOCUMENTS
// ---------------------------------------------------------------------------
function DocumentsTab({
  studentId,
  documents,
}: {
  studentId: string;
  documents: { id: string; type: string; title: string; fileUrl: string; createdAt: Date; uploadedBy: { name: string } | null }[];
}) {
  return (
    <Panel title="Documents" action={<AddDocumentModal studentId={studentId} />}>
      {documents.length === 0 ? (
        <EmptyState title="No documents uploaded" hint="Photos, ID proofs, marksheets, consent forms & certificates." icon={<FolderOpen className="h-8 w-8" />} />
      ) : (
        <div className="divide-y divide-slate-50">
          {documents.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy">
                  <FileText className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-700">{d.title}</p>
                  <p className="text-xs text-slate-400">
                    {titleCase(d.type)} · {fmtDate(d.createdAt)}
                    {d.uploadedBy ? ` · ${d.uploadedBy.name}` : ""}
                  </p>
                </div>
              </div>
              <a href={d.fileUrl} target="_blank" rel="noreferrer" className="btn-ghost text-xs">
                Open
              </a>
            </div>
          ))}
        </div>
      )}
    </Panel>
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

function AddDocumentModal({ studentId }: { studentId: string }) {
  const types = ["PHOTO", "ID_PROOF", "MARKSHEET", "CONSENT_FORM", "CERTIFICATE", "SESSION_NOTE", "ASSESSMENT_REPORT", "OTHER"];
  return (
    <Modal
      title="Add Document"
      triggerClassName="btn-outline text-xs"
      triggerLabel={<><Plus className="h-3.5 w-3.5" /> Add</>}
    >
      <ActionForm action={addDocument} className="space-y-4">
          <input type="hidden" name="studentId" value={studentId} />
          <Field label="Type">
            <select name="type" className="input" required defaultValue="OTHER">
              {types.map((t) => (
                <option key={t} value={t}>
                  {titleCase(t)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Title">
            <input name="title" className="input" required placeholder="e.g. Birth Certificate" />
          </Field>
          <Field label="Upload file" hint="PDF, image or document (max 10MB)">
            <input type="file" name="file" className="input" accept=".pdf,.png,.jpg,.jpeg,.doc,.docx" />
          </Field>
          <Field label="…or File URL">
            <input name="fileUrl" className="input" placeholder="https://…" />
          </Field>
          <div className="flex justify-end">
            <SubmitButton>Add document</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}
