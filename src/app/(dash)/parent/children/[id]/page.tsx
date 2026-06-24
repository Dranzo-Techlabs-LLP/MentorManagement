import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  GraduationCap,
  Building2,
  Mail,
  Phone,
  Target,
  Trophy,
  FileBarChart,
  CalendarDays,
  UserX,
} from "lucide-react";
import type { GrowthCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, Avatar, Badge, Progress, EmptyState } from "@/components/ui/primitives";
import { Panel, MiniMetric } from "@/components/dash/widgets";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SkillRadarChart } from "@/components/ui/charts";
import { ageFromDob, ageCategory, CATEGORY_LABEL, fmtDate, fmtDateTime, titleCase } from "@/lib/utils";

const RADAR_AXES: { axis: string; category: GrowthCategory }[] = [
  { axis: "Academic", category: "ACADEMIC" },
  { axis: "Leadership", category: "LIFE_SKILLS" },
  { axis: "Character", category: "MORAL_VALUE" },
  { axis: "Life Skills", category: "HEALTH_WELLBEING" },
  { axis: "Communication", category: "PERSONALITY" },
  { axis: "Spiritual", category: "CAREER" },
];

export default async function ParentChildDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      mentor: true,
      institution: true,
      growthRecords: { select: { category: true, score: true } },
      goals: { orderBy: { createdAt: "desc" } },
      achievements: { orderBy: { date: "desc" } },
      assessments: {
        where: { status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        include: { template: true },
      },
      attendance: { orderBy: { session: { scheduledAt: "desc" } }, take: 8, include: { session: true } },
    },
  });

  // Guard: parent must own this child.
  if (!student || student.parentId !== session.userId) {
    return (
      <>
        <Link href="/parent/children" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy">
          <ArrowLeft className="h-4 w-4" /> Back to my children
        </Link>
        <Panel>
          <EmptyState
            title="Profile unavailable"
            hint="This profile is not linked to your account, or does not exist."
            icon={<UserX className="h-8 w-8" />}
          />
        </Panel>
      </>
    );
  }

  const age = ageFromDob(student.dob);
  const level = student.ageCategory ?? ageCategory(age);

  const radarData = RADAR_AXES.map(({ axis, category }) => {
    const scores = student.growthRecords
      .filter((r) => r.category === category && r.score != null)
      .map((r) => r.score as number);
    const avg = scores.length ? Math.round(scores.reduce((a, n) => a + n, 0) / scores.length) : 0;
    return { axis, Score: avg };
  });
  const hasGrowth = radarData.some((d) => d.Score > 0);
  const scored = radarData.filter((d) => d.Score > 0);
  const overall = scored.length ? Math.round(scored.reduce((a, d) => a + d.Score, 0) / scored.length) : 0;
  const completedGoals = student.goals.filter((g) => g.status === "COMPLETED").length;

  return (
    <>
      <Link href="/parent/children" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Back to my children
      </Link>

      {/* Header */}
      <div className="card mb-5 p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={student.fullName} src={student.photo} size={88} tint="#6d28d9" />
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
              <InfoLine icon={<Building2 className="h-4 w-4" />} label="Institution" value={student.institution?.name ?? "—"} />
              <InfoLine icon={<Mail className="h-4 w-4" />} label="Email" value={student.email ?? "—"} />
              <InfoLine icon={<Phone className="h-4 w-4" />} label="Phone" value={student.phone ?? "—"} />
            </div>
          </div>
        </div>
      </div>

      <PageHeader title="Growth Portfolio" subtitle="A read-only view of your child's development" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniMetric label="Overall Growth Index" value={`${overall}%`} sub="Avg across 6 dimensions" />
        <MiniMetric label="Goals" value={`${completedGoals}/${student.goals.length}`} sub="Completed / total" />
        <MiniMetric label="Achievements" value={student.achievements.length} sub="Milestones earned" />
        <MiniMetric label="Assessments" value={student.assessments.length} sub="Completed" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Skill Profile">
          {hasGrowth ? (
            <SkillRadarChart data={radarData} series={[{ key: "Score", label: "Avg Score", color: "#6d28d9" }]} />
          ) : (
            <EmptyState title="No growth data yet" hint="The mentor will log development scores over time." />
          )}
        </Panel>

        <Panel title="Goals">
          {student.goals.length === 0 ? (
            <EmptyState title="No goals set" hint="Goals set by the mentor will appear here." icon={<Target className="h-8 w-8" />} />
          ) : (
            <div className="space-y-4">
              {student.goals.map((g) => (
                <div key={g.id}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-700">{g.title}</p>
                    <StatusBadge status={g.status} />
                  </div>
                  {g.description && <p className="mb-1.5 text-xs text-slate-400">{g.description}</p>}
                  <Progress value={g.progress} color="#6d28d9" />
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
        <Panel title="Achievements">
          {student.achievements.length === 0 ? (
            <EmptyState title="No achievements yet" hint="Milestones will be celebrated here." icon={<Trophy className="h-8 w-8" />} />
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

        <Panel title="Recent Sessions">
          {student.attendance.length === 0 ? (
            <EmptyState title="No sessions yet" hint="Mentoring sessions will appear here." icon={<CalendarDays className="h-8 w-8" />} />
          ) : (
            <div className="divide-y divide-slate-50">
              {student.attendance.map((att) => (
                <div key={att.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">{att.session.title}</p>
                    <p className="text-xs text-slate-400">
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
      </div>

      <div className="mt-4">
        <Panel title="Completed Assessments">
          {student.assessments.length === 0 ? (
            <EmptyState title="No completed assessments" hint="Results will appear once assessments are taken." icon={<FileBarChart className="h-8 w-8" />} />
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
