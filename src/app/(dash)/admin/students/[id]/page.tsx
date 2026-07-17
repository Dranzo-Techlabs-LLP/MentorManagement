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
  Pencil,
  Trophy,
  Target,
  FileText,
  CalendarDays,
  CalendarClock,
  Sparkles,
  FolderOpen,
  Trash2,
} from "lucide-react";
import type { GrowthCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPerms } from "@/lib/permissions";
import {
  addGrowthRecord, deleteGrowthRecord, addAchievement, updateAchievement, deleteAchievement,
  createGoal, updateGoal, deleteGoal, addDocument, updateDocument, deleteDocument,
  saveStudent, deleteStudent, upsertSwoc, addMonthlyUpdate, assignMentor,
} from "@/lib/actions";
import { PageHeader, Avatar, Badge, Progress, EmptyState } from "@/components/ui/primitives";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { Panel, MiniMetric, ActivityItem } from "@/components/dash/widgets";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TabLinks } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton, Field } from "@/components/ui/form";
import { StudentFormFields } from "../StudentFormFields";
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
  { key: "updates", label: "Monthly Updates" },
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
      swoc: true,
      monthlyUpdates: { orderBy: { createdAt: "desc" }, include: { mentor: { select: { name: true } } } },
    },
  });

  if (!student) notFound();

  const studentPerms = await getPerms("students");
  const [institutions, mentors, parents, mentorPool] = await Promise.all([
    prisma.institution.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: "MENTOR" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: "PARENT" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({
      where: { role: "MENTOR", status: "ACTIVE" },
      select: { id: true, name: true, city: true, languages: true, exposure: true, timezone: true, mentoringMode: true, yearsExperience: true },
    }),
  ]);

  const suggestions = rankMentors(student, mentorPool);

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
              <InfoLine
                icon={<GraduationCap className="h-4 w-4" />}
                label="Mentor"
                value={student.mentor?.name ?? "Unassigned"}
                href={student.mentor ? `/admin/mentors/${student.mentor.id}` : undefined}
              />
              <InfoLine icon={<Users className="h-4 w-4" />} label="Parent" value={student.parent?.name ?? "—"} />
              <InfoLine icon={<Building2 className="h-4 w-4" />} label="Institution" value={student.institution?.name ?? "—"} />
              <InfoLine icon={<Mail className="h-4 w-4" />} label="Email" value={student.email ?? "—"} />
              <InfoLine icon={<Phone className="h-4 w-4" />} label="Phone" value={student.phone ?? "—"} />
              <InfoLine icon={<MapPin className="h-4 w-4" />} label="Address" value={student.address ?? "—"} />
            </div>
          </div>
        </div>
      </div>

      <PageHeader
        title="Student Master Profile"
        subtitle="Digital growth portfolio & program records"
        action={
          <div className="flex flex-wrap items-center gap-2">
            {studentPerms.edit && (
              <EditStudentModal student={student} institutions={institutions} mentors={mentors} parents={parents} />
            )}
            {studentPerms.delete && (
              <ConfirmDeleteButton
                action={deleteStudent}
                hiddenFields={{ id: student.id }}
                itemLabel={student.fullName}
                warning="This permanently removes the student and all of their growth records, reports, assessments, goals, tasks and documents. This cannot be undone."
                triggerClassName="btn-outline text-red-600"
              />
            )}
          </div>
        }
      />

      <TabLinks tabs={TABS} />

      {active === "profile" && <ProfileTab student={student} age={age} level={level} suggestions={suggestions} />}
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
      {active === "updates" && <MonthlyUpdatesTab studentId={student.id} updates={student.monthlyUpdates} />}
      {active === "documents" && <DocumentsTab studentId={student.id} documents={student.documents} />}
    </>
  );
}

function InfoLine({ icon, label, value, href }: { icon: React.ReactNode; label: string; value: string; href?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <span className="text-slate-400">{label}:</span>
      {href ? (
        <Link href={href} className="truncate font-medium text-navy hover:underline">
          {value}
        </Link>
      ) : (
        <span className="truncate font-medium text-slate-700">{value}</span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PROFILE
// ---------------------------------------------------------------------------
type SwocData = { strengths: string | null; weaknesses: string | null; opportunities: string | null; challenges: string | null };

type ProfileStudent = {
  id: string;
  gender: string | null; dob: Date | null; className: string | null; rollNo: string | null;
  bloodGroup: string | null; admissionDate: Date; email: string | null; phone: string | null;
  city: string | null; address: string | null; notes: string | null;
  registrationNumber: string | null; yearOfStudy: string | null;
  fatherOccupation: string | null; motherOccupation: string | null;
  plusTwoPercentage: string | null; languagesKnown: string | null;
  interests: string | null; talents: string | null; sports: string | null; cultural: string | null;
  hobbies: string | null; careerAspiration: string | null; otherTalent: string | null; lifeGoal: string | null;
  problems: string | null; healthProblems: string | null; mentorRemarks: string | null;
  swoc: SwocData | null;
};

function ProfileTab({
  student,
  age,
  level,
  suggestions,
}: {
  student: ProfileStudent;
  age: number | null;
  level: string | null;
  suggestions: MentorSuggestion[];
}) {
  const aspirations: [string, string | null][] = [
    ["Career aspiration", student.careerAspiration],
    ["Life goal", student.lifeGoal],
    ["Hobbies", student.hobbies],
    ["Sports", student.sports],
    ["Cultural", student.cultural],
    ["Other talent / skill", student.otherTalent],
  ];
  const additional: [string, string | null][] = [
    ["Any problems", student.problems],
    ["Any health problems", student.healthProblems],
    ["Mentor's remarks", student.mentorRemarks],
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <Panel title="Personal Details">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="Gender" value={student.gender ?? "—"} />
            <Detail label="Date of birth" value={fmtDate(student.dob)} />
            <Detail label="Age" value={age != null ? `${age} years` : "—"} />
            <Detail label="Age category" value={level ? CATEGORY_LABEL[level] : "—"} />
            <Detail label="Registration no." value={student.registrationNumber ?? "—"} />
            <Detail label="Class / Grade" value={student.className ?? "—"} />
            <Detail label="Year of study" value={student.yearOfStudy ?? "—"} />
            <Detail label="Roll number" value={student.rollNo ?? "—"} />
            <Detail label="Blood group" value={student.bloodGroup ?? "—"} />
            <Detail label="Email" value={student.email ?? "—"} />
            <Detail label="Phone" value={student.phone ?? "—"} />
            <Detail label="City" value={student.city ?? "—"} />
            <Detail label="Address" value={student.address ?? "—"} />
            <Detail label="Admission date" value={fmtDate(student.admissionDate)} />
          </div>
          {student.notes && (
            <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
              <p className="mb-1 font-semibold text-slate-500">Notes</p>
              {student.notes}
            </div>
          )}
        </Panel>

        <Panel title="Family & Educational Background">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            <Detail label="Father's occupation" value={student.fatherOccupation ?? "—"} />
            <Detail label="Mother's occupation" value={student.motherOccupation ?? "—"} />
            <Detail label="Marks in +2 (%)" value={student.plusTwoPercentage ?? "—"} />
            <Detail label="Languages known" value={student.languagesKnown ?? "—"} />
          </div>
        </Panel>

        <Panel title="Aspirations">
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
            {aspirations.map(([label, value]) => (
              <Detail key={label} label={label} value={value ?? "—"} />
            ))}
          </div>
        </Panel>

        <Panel title="Additional Information">
          <div className="space-y-3">
            {additional.map(([label, value]) => (
              <div key={label}>
                <p className="text-xs font-medium text-slate-400">{label}</p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{value || "—"}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>

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
        <SwocPanel studentId={student.id} swoc={student.swoc} />
        <MentorMatchPanel studentId={student.id} suggestions={suggestions} />
      </div>
    </div>
  );
}

type MentorSuggestion = {
  id: string; name: string; city: string | null; languages: string | null; exposure: string | null;
  timezone: string | null; mentoringMode: string | null; yearsExperience: number | null;
  score: number; reasons: string[];
};

function rankMentors(
  student: { preferredMode: string | null; city: string | null; languagesKnown: string | null },
  pool: {
    id: string; name: string; city: string | null; languages: string | null; exposure: string | null;
    timezone: string | null; mentoringMode: string | null; yearsExperience: number | null;
  }[],
): MentorSuggestion[] {
  const mode = student.preferredMode;
  const studLangs = (student.languagesKnown ?? "").toLowerCase().split(/[,/]/).map((x) => x.trim()).filter(Boolean);
  return pool
    .map((m) => {
      let score = 0;
      const reasons: string[] = [];
      if (mode && m.mentoringMode && (m.mentoringMode === mode || m.mentoringMode === "BOTH" || mode === "BOTH")) {
        score += 2;
        reasons.push(`${titleCase(m.mentoringMode)} available`);
      }
      if ((mode === "OFFLINE" || mode === "BOTH" || !mode) && student.city && m.city && m.city.toLowerCase() === student.city.toLowerCase()) {
        score += 3;
        reasons.push(`Same city (${m.city})`);
      }
      if ((mode === "ONLINE" || mode === "BOTH" || !mode) && studLangs.length && m.languages && studLangs.some((l) => m.languages!.toLowerCase().includes(l))) {
        score += 2;
        reasons.push("Shared language");
      }
      if (m.exposure) {
        score += 0.5;
        reasons.push(m.exposure);
      }
      if (m.yearsExperience) score += Math.min(1, m.yearsExperience / 10);
      return { ...m, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

function MentorMatchPanel({ studentId, suggestions }: { studentId: string; suggestions: MentorSuggestion[] }) {
  return (
    <Panel title="Mentor Match" action={<Sparkles className="h-4 w-4 text-gold" />}>
      {suggestions.length === 0 ? (
        <p className="text-sm text-slate-400">No mentors in the resource pool yet.</p>
      ) : (
        <div className="space-y-3">
          {suggestions.map((m) => (
            <div key={m.id} className="rounded-lg border border-slate-100 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-700">{m.name}</p>
                <ActionForm action={assignMentor} className="inline-flex">
                  <input type="hidden" name="studentId" value={studentId} />
                  <input type="hidden" name="mentorId" value={m.id} />
                  <SubmitButton className="btn-ghost text-xs" pendingText="…">Assign</SubmitButton>
                </ActionForm>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                {m.mentoringMode && <Badge tone="teal">{titleCase(m.mentoringMode)}</Badge>}
                {m.city && <span>📍 {m.city}</span>}
                {m.languages && <span>🗣 {m.languages}</span>}
              </div>
              {m.reasons.length > 0 && <p className="mt-1 text-xs font-medium text-leaf-700">{m.reasons.join(" · ")}</p>}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function SwocPanel({ studentId, swoc }: { studentId: string; swoc: SwocData | null }) {
  const items = [
    { label: "Strengths", value: swoc?.strengths, tone: "text-leaf-700" },
    { label: "Weaknesses", value: swoc?.weaknesses, tone: "text-red-600" },
    { label: "Opportunities", value: swoc?.opportunities, tone: "text-navy-700" },
    { label: "Challenges", value: swoc?.challenges, tone: "text-amber-700" },
  ];
  const hasAny = items.some((i) => i.value);
  return (
    <Panel title="SWOC Analysis" action={<SwocModal studentId={studentId} swoc={swoc} />}>
      {hasAny ? (
        <div className="space-y-3">
          {items.map((i) => (
            <div key={i.label}>
              <p className={`text-xs font-bold uppercase tracking-wide ${i.tone}`}>{i.label}</p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{i.value || "—"}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400">No SWOC analysis yet. Capture strengths, weaknesses, opportunities & challenges.</p>
      )}
    </Panel>
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
    goals: { id: string; title: string; description: string | null; category: string | null; progress: number; status: string; targetDate: Date | null }[];
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
                <div key={g.id} className="group">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">{g.title}</p>
                    <div className="flex items-center gap-1.5">
                      <StatusBadge status={g.status} />
                      <span className="flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                        <EditGoalModal goal={g} />
                        <ConfirmDeleteButton
                          action={deleteGoal}
                          hiddenFields={{ id: g.id }}
                          itemLabel={g.title}
                          triggerClassName="btn-ghost px-1.5 py-1 text-xs text-red-600"
                          triggerLabel={<Trash2 className="h-3.5 w-3.5" />}
                        />
                      </span>
                    </div>
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
                <div key={a.id} className="group relative flex gap-3 py-2 pl-0">
                  <span className="relative z-10 mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold/20">
                    <Trophy className="h-2.5 w-2.5 text-gold" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-700">{a.title}</p>
                      <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                        <EditAchievementModal achievement={a} />
                        <ConfirmDeleteButton
                          action={deleteAchievement}
                          hiddenFields={{ id: a.id }}
                          itemLabel={a.title}
                          triggerClassName="btn-ghost px-1.5 py-1 text-xs text-red-600"
                          triggerLabel={<Trash2 className="h-3.5 w-3.5" />}
                        />
                      </span>
                    </div>
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
                      <div key={r.id} className="group flex items-start justify-between gap-3 py-2.5">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-700">{r.title}</p>
                          {r.note && <p className="text-xs text-slate-400">{r.note}</p>}
                          <p className="mt-0.5 text-xs text-slate-400">
                            {fmtDate(r.date)}
                            {r.recordedBy && ` · ${r.recordedBy.name}`}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {r.score != null && (
                            <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-sm font-bold text-navy">
                              {r.score}
                            </span>
                          )}
                          <span className="opacity-0 transition group-hover:opacity-100">
                            <ConfirmDeleteButton
                              action={deleteGrowthRecord}
                              hiddenFields={{ id: r.id }}
                              itemLabel={r.title}
                              triggerClassName="btn-ghost px-1.5 py-1 text-xs text-red-600"
                              triggerLabel={<Trash2 className="h-3.5 w-3.5" />}
                            />
                          </span>
                        </div>
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
              <div className="flex shrink-0 items-center gap-1">
                <a href={d.fileUrl} target="_blank" rel="noreferrer" className="btn-ghost text-xs">
                  Open
                </a>
                <EditDocumentModal doc={d} />
                <ConfirmDeleteButton
                  action={deleteDocument}
                  hiddenFields={{ id: d.id }}
                  itemLabel={d.title}
                  triggerClassName="btn-ghost text-xs text-red-600"
                />
              </div>
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

function EditAchievementModal({
  achievement,
}: {
  achievement: { id: string; title: string; description: string | null; category: string | null };
}) {
  return (
    <Modal title="Edit Achievement" triggerClassName="btn-ghost px-1.5 py-1 text-xs" triggerLabel={<Pencil className="h-3.5 w-3.5" />}>
      <ActionForm action={updateAchievement} className="space-y-4" successMessage="Achievement updated.">
        <input type="hidden" name="id" value={achievement.id} />
        <Field label="Title">
          <input name="title" className="input" required defaultValue={achievement.title} />
        </Field>
        <Field label="Category">
          <input name="category" className="input" defaultValue={achievement.category ?? ""} placeholder="Leadership, Academic, Sports…" />
        </Field>
        <Field label="Description">
          <textarea name="description" className="input" rows={3} defaultValue={achievement.description ?? ""} />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Save changes</SubmitButton>
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

function EditGoalModal({
  goal,
}: {
  goal: { id: string; title: string; description: string | null; category: string | null; targetDate: Date | null };
}) {
  return (
    <Modal title="Edit Goal" triggerClassName="btn-ghost px-1.5 py-1 text-xs" triggerLabel={<Pencil className="h-3.5 w-3.5" />}>
      <ActionForm action={updateGoal} className="space-y-4" successMessage="Goal updated.">
        <input type="hidden" name="id" value={goal.id} />
        <Field label="Goal title">
          <input name="title" className="input" required defaultValue={goal.title} />
        </Field>
        <Field label="Description">
          <textarea name="description" className="input" rows={3} defaultValue={goal.description ?? ""} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category">
            <select name="category" className="input" defaultValue={goal.category ?? ""}>
              <option value="">— None —</option>
              {GROWTH_CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
            </select>
          </Field>
          <Field label="Target date">
            <input name="targetDate" type="date" className="input" defaultValue={goal.targetDate ? new Date(goal.targetDate).toISOString().slice(0, 10) : ""} />
          </Field>
        </div>
        <div className="flex justify-end">
          <SubmitButton>Save changes</SubmitButton>
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

function SwocModal({ studentId, swoc }: { studentId: string; swoc: SwocData | null }) {
  return (
    <Modal
      title="SWOC Analysis"
      triggerClassName="btn-outline text-xs"
      triggerLabel={<><Pencil className="h-3.5 w-3.5" /> {swoc ? "Edit" : "Add"}</>}
    >
      <ActionForm action={upsertSwoc} className="space-y-4" successMessage="SWOC analysis saved.">
        <input type="hidden" name="studentId" value={studentId} />
        <Field label="Strengths">
          <textarea name="strengths" className="input" rows={2} defaultValue={swoc?.strengths ?? ""} placeholder="What the mentee does well, unique resources…" />
        </Field>
        <Field label="Weaknesses">
          <textarea name="weaknesses" className="input" rows={2} defaultValue={swoc?.weaknesses ?? ""} placeholder="Areas to improve, fewer resources…" />
        </Field>
        <Field label="Opportunities">
          <textarea name="opportunities" className="input" rows={2} defaultValue={swoc?.opportunities ?? ""} placeholder="Openings for personal & professional development…" />
        </Field>
        <Field label="Challenges">
          <textarea name="challenges" className="input" rows={2} defaultValue={swoc?.challenges ?? ""} placeholder="Key challenges & difficulties in overcoming them…" />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Save SWOC</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}

function EditStudentModal({
  student,
  institutions,
  mentors,
  parents,
}: {
  student: React.ComponentProps<typeof StudentFormFields>["student"];
  institutions: { id: string; name: string }[];
  mentors: { id: string; name: string }[];
  parents: { id: string; name: string }[];
}) {
  return (
    <Modal
      wide
      title="Edit Student Profile"
      triggerClassName="btn-outline"
      triggerLabel={<><Pencil className="h-4 w-4" /> Edit profile</>}
    >
      <ActionForm action={saveStudent} className="space-y-4" successMessage="Profile updated.">
        <StudentFormFields student={student} institutions={institutions} mentors={mentors} parents={parents} />
        <div className="flex justify-end gap-2 pt-2">
          <SubmitButton>Save changes</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}

function MonthlyUpdatesTab({
  studentId,
  updates,
}: {
  studentId: string;
  updates: { id: string; month: string; summary: string; progress: number | null; createdAt: Date; mentor: { name: string } | null }[];
}) {
  return (
    <Panel title="Monthly Meetup Updates" action={<AddMonthlyUpdateModal studentId={studentId} />}>
      {updates.length === 0 ? (
        <EmptyState
          title="No monthly updates yet"
          hint="Log how the mentee changed each month after the offline meetup."
          icon={<CalendarClock className="h-8 w-8" />}
        />
      ) : (
        <div className="space-y-4">
          {updates.map((u) => (
            <div key={u.id} className="rounded-xl border border-slate-100 p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-navy">{u.month}</p>
                {u.progress != null && (
                  <span className="rounded-lg bg-slate-50 px-2.5 py-1 text-sm font-bold text-navy">{u.progress}%</span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">{u.summary}</p>
              <p className="mt-1 text-xs text-slate-400">
                {fmtDate(u.createdAt)}
                {u.mentor ? ` · ${u.mentor.name}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function AddMonthlyUpdateModal({ studentId }: { studentId: string }) {
  return (
    <Modal
      title="Add Monthly Update"
      triggerClassName="btn-outline text-xs"
      triggerLabel={<><Plus className="h-3.5 w-3.5" /> Add</>}
    >
      <ActionForm action={addMonthlyUpdate} className="space-y-4" successMessage="Monthly update saved.">
        <input type="hidden" name="studentId" value={studentId} />
        <Field label="Month" hint="e.g. July 2026 (defaults to current month)">
          <input name="month" className="input" placeholder="July 2026" />
        </Field>
        <Field label="How the mentee changed this month">
          <textarea name="summary" className="input" rows={4} required placeholder="Progress, behaviour, achievements, concerns…" />
        </Field>
        <Field label="Overall progress (%)" hint="Optional">
          <input name="progress" type="number" min={0} max={100} className="input" placeholder="70" />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Save update</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}

function EditDocumentModal({ doc }: { doc: { id: string; title: string; type: string } }) {
  const types = ["PHOTO", "ID_PROOF", "MARKSHEET", "CONSENT_FORM", "CERTIFICATE", "SESSION_NOTE", "ASSESSMENT_REPORT", "OTHER"];
  return (
    <Modal title="Edit Document" triggerClassName="btn-ghost text-xs" triggerLabel={<><Pencil className="h-3.5 w-3.5" /> Edit</>}>
      <ActionForm action={updateDocument} className="space-y-4" successMessage="Document updated.">
        <input type="hidden" name="id" value={doc.id} />
        <Field label="Type">
          <select name="type" className="input" required defaultValue={doc.type}>
            {types.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
          </select>
        </Field>
        <Field label="Title">
          <input name="title" className="input" required defaultValue={doc.title} />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Save changes</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}
