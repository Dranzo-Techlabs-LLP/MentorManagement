import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, CalendarDays, FileText, ListChecks } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, StatCard, Avatar, Progress, EmptyState } from "@/components/ui/primitives";
import { Panel, QuickAction } from "@/components/dash/widgets";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fmtDateTime } from "@/lib/utils";

function avgScore(records: { score: number | null }[]) {
  const scored = records.filter((r) => r.score != null);
  if (!scored.length) return 0;
  return Math.round(scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length);
}

export default async function MentorDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  const mentorId = session.userId;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [mentees, sessionsThisMonth, reportsSubmitted, pendingTasks, upcomingSessions, recentReports] =
    await Promise.all([
      prisma.student.findMany({
        where: { mentorId },
        orderBy: { fullName: "asc" },
        include: { growthRecords: { select: { score: true } } },
      }),
      prisma.mentoringSession.count({
        where: { mentorId, scheduledAt: { gte: monthStart, lt: monthEnd } },
      }),
      prisma.progressReport.count({ where: { submittedById: mentorId } }),
      prisma.task.count({ where: { createdById: mentorId, status: { not: "DONE" } } }),
      prisma.mentoringSession.findMany({
        where: { mentorId, status: "SCHEDULED", scheduledAt: { gte: now } },
        orderBy: { scheduledAt: "asc" },
        take: 6,
        include: { attendance: { include: { student: true } } },
      }),
      prisma.progressReport.findMany({
        where: { submittedById: mentorId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { student: true },
      }),
    ]);

  return (
    <>
      <PageHeader title="Mentor Dashboard" subtitle={`Welcome back, ${session.name} · SLEP Mentoring`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="My Mentees" value={mentees.length} icon={<Users className="h-5 w-5" />} tint="#0E2A5E" />
        <StatCard label="Sessions This Month" value={sessionsThisMonth} icon={<CalendarDays className="h-5 w-5" />} tint="#2FA84F" />
        <StatCard label="Reports Submitted" value={reportsSubmitted} icon={<FileText className="h-5 w-5" />} tint="#E0A92E" />
        <StatCard label="Pending Tasks" value={pendingTasks} icon={<ListChecks className="h-5 w-5" />} tint="#14A1A8" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          title="Mentees Overview"
          className="lg:col-span-2"
          action={
            <Link href="/mentor/mentees" className="btn-ghost text-xs">
              View All Mentees
            </Link>
          }
        >
          {mentees.length === 0 ? (
            <EmptyState title="No mentees assigned yet" hint="Students assigned to you will appear here." icon={<Users className="h-8 w-8" />} />
          ) : (
            <div className="space-y-4">
              {mentees.slice(0, 6).map((m) => {
                const avg = avgScore(m.growthRecords);
                return (
                  <div key={m.id} className="flex items-center gap-3">
                    <Avatar name={m.fullName} src={m.photo} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/mentor/mentees/${m.id}`} className="truncate text-sm font-semibold text-navy hover:underline">
                          {m.fullName}
                        </Link>
                        <span className="shrink-0 text-xs text-slate-400">{m.className ?? "—"}</span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-3">
                        <Progress value={avg} />
                        <span className="shrink-0 text-xs font-semibold text-slate-500">{avg}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Quick Actions">
          <div className="space-y-2.5">
            <QuickAction href="/mentor/sessions" label="Schedule a Session" tone="navy" />
            <QuickAction href="/mentor/reports" label="Create a Report" tone="green" />
            <QuickAction href="/mentor/messages" label="Send a Message" tone="gold" />
            <QuickAction href="/mentor/tasks" label="Manage Tasks" tone="outline" />
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Panel title="Upcoming Sessions">
          {upcomingSessions.length === 0 ? (
            <EmptyState title="No upcoming sessions" hint="Schedule a session to see it here." icon={<CalendarDays className="h-8 w-8" />} />
          ) : (
            <div className="divide-y divide-slate-50">
              {upcomingSessions.map((s) => {
                const names = s.attendance.map((a) => a.student.fullName).join(", ");
                return (
                  <Link key={s.id} href={`/mentor/sessions/${s.id}`} className="block py-3 transition hover:opacity-80">
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-slate-700">{s.title}</p>
                      <StatusBadge status={s.status} />
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{fmtDateTime(s.scheduledAt)}</p>
                    {names && <p className="mt-0.5 truncate text-xs text-slate-400">With: {names}</p>}
                  </Link>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          title="Recent Reports"
          action={
            <Link href="/mentor/reports" className="btn-ghost text-xs">
              All reports
            </Link>
          }
        >
          {recentReports.length === 0 ? (
            <EmptyState title="No reports yet" hint="Reports you submit will appear here." icon={<FileText className="h-8 w-8" />} />
          ) : (
            <div className="divide-y divide-slate-50">
              {recentReports.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-700">{r.title}</p>
                    <p className="text-xs text-slate-400">{r.student.fullName}{r.period ? ` · ${r.period}` : ""}</p>
                  </div>
                  <StatusBadge status={r.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
