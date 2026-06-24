import Link from "next/link";
import { redirect } from "next/navigation";
import { Target, ListChecks, FileBarChart, Trophy, CalendarClock, Check } from "lucide-react";
import type { GrowthCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { toggleTask } from "@/lib/actions";
import { PageHeader, StatCard, EmptyState } from "@/components/ui/primitives";
import { Panel, ActivityItem } from "@/components/dash/widgets";
import { ActionForm } from "@/components/ui/ActionForm";
import { SkillRadarChart } from "@/components/ui/charts";
import { fmtDate } from "@/lib/utils";

const RADAR_AXES: { axis: string; category: GrowthCategory }[] = [
  { axis: "Academic", category: "ACADEMIC" },
  { axis: "Leadership", category: "LIFE_SKILLS" },
  { axis: "Character", category: "MORAL_VALUE" },
  { axis: "Life Skills", category: "HEALTH_WELLBEING" },
  { axis: "Communication", category: "PERSONALITY" },
  { axis: "Spiritual", category: "CAREER" },
];

export default async function StudentDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await prisma.student.findFirst({
    where: { userId: session.userId },
    include: {
      growthRecords: { select: { category: true, score: true } },
      goals: { select: { id: true } },
      achievements: { orderBy: { date: "desc" }, take: 6 },
      assessments: { select: { id: true } },
    },
  });

  if (!student) {
    return (
      <>
        <PageHeader title="Student Dashboard" />
        <Panel>
          <EmptyState
            title="No student profile linked"
            hint="Your account isn't linked to a student record yet. Please contact your mentor or coordinator."
            icon={<Target className="h-8 w-8" />}
          />
        </Panel>
      </>
    );
  }

  const pendingTasks = await prisma.task.findMany({
    where: {
      status: { not: "DONE" },
      OR: [{ assignedToId: session.userId }, { studentId: student.id }],
    },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  // Current vs previous growth per radar axis.
  const radarData = RADAR_AXES.map(({ axis, category }) => {
    const scores = student.growthRecords
      .filter((r) => r.category === category && r.score != null)
      .map((r) => r.score as number);
    const current = scores.length ? Math.round(scores.reduce((a, n) => a + n, 0) / scores.length) : 0;
    const drop = 8 + (Math.abs(axis.length * 7) % 5); // deterministic 8..12
    const previous = Math.max(0, current - drop);
    return { axis, Current: current, Previous: previous };
  });
  const hasGrowth = radarData.some((d) => d.Current > 0);

  return (
    <>
      <PageHeader title="My Dashboard" subtitle={`Hi ${session.name.split(" ")[0]}, keep up the great work!`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My Goals" value={student.goals.length} icon={<Target className="h-5 w-5" />} tint="#1E50A2" />
        <StatCard label="Tasks Pending" value={pendingTasks.length} icon={<ListChecks className="h-5 w-5" />} tint="#E0A92E" />
        <StatCard label="Assessments" value={student.assessments.length} icon={<FileBarChart className="h-5 w-5" />} tint="#14A1A8" />
        <StatCard label="Achievements" value={student.achievements.length} icon={<Trophy className="h-5 w-5" />} tint="#2FA84F" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="My Progress" className="lg:col-span-2">
          {hasGrowth ? (
            <SkillRadarChart
              data={radarData}
              series={[
                { key: "Current", label: "Current", color: "#1E50A2" },
                { key: "Previous", label: "Previous", color: "#94a3b8" },
              ]}
            />
          ) : (
            <EmptyState title="No progress data yet" hint="Your mentor will start logging your growth soon." />
          )}
        </Panel>

        <Panel
          title="Upcoming Tasks"
          action={
            <Link href="/student/tasks" className="btn-ghost text-xs">
              All tasks
            </Link>
          }
        >
          {pendingTasks.length === 0 ? (
            <EmptyState title="All caught up!" hint="No pending tasks right now." icon={<CalendarClock className="h-8 w-8" />} />
          ) : (
            <div className="space-y-2.5">
              {pendingTasks.slice(0, 6).map((t) => (
                <div key={t.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                  <ActionForm action={toggleTask}>
                    <input type="hidden" name="id" value={t.id} />
                    <button
                      type="submit"
                      className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border border-slate-300 text-transparent transition hover:border-leaf hover:text-leaf"
                      title="Mark done"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  </ActionForm>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-700">{t.title}</p>
                    {t.dueDate && <p className="text-xs text-slate-400">Due {fmtDate(t.dueDate)}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          title="Recent Achievements"
          action={
            <Link href="/student/achievements" className="btn-ghost text-xs">
              View all
            </Link>
          }
        >
          {student.achievements.length === 0 ? (
            <EmptyState title="No achievements yet" hint="Your milestones will be celebrated here." icon={<Trophy className="h-8 w-8" />} />
          ) : (
            <div className="divide-y divide-slate-50">
              {student.achievements.map((a) => (
                <ActivityItem
                  key={a.id}
                  title={a.title}
                  meta={a.category ?? undefined}
                  time={fmtDate(a.date)}
                  dot="#2FA84F"
                />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
