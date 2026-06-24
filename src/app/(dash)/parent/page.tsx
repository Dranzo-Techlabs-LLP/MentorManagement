import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Users,
  CalendarDays,
  FileText,
  MessageSquare,
  Megaphone,
  ArrowRight,
} from "lucide-react";
import type { GrowthCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, Avatar, EmptyState } from "@/components/ui/primitives";
import { Panel, ActivityItem } from "@/components/dash/widgets";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { SkillRadarChart } from "@/components/ui/charts";
import { fmtDateTime, timeAgo } from "@/lib/utils";

// The six growth dimensions mapped to the mockup's radar axes.
const RADAR_AXES: { axis: string; category: GrowthCategory }[] = [
  { axis: "Academic", category: "ACADEMIC" },
  { axis: "Leadership", category: "LIFE_SKILLS" },
  { axis: "Character", category: "MORAL_VALUE" },
  { axis: "Life Skills", category: "HEALTH_WELLBEING" },
  { axis: "Communication", category: "PERSONALITY" },
  { axis: "Spiritual", category: "CAREER" },
];

export default async function ParentDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");
  const parentId = session.userId;
  const now = new Date();

  const children = await prisma.student.findMany({
    where: { parentId },
    orderBy: { fullName: "asc" },
    include: {
      mentor: true,
      growthRecords: { select: { category: true, score: true } },
    },
  });
  const childIds = children.map((c) => c.id);

  const [recentSessions, sharedReports, recentMessages, upcomingSessions, announcements] =
    await Promise.all([
      childIds.length
        ? prisma.sessionAttendance.findMany({
            where: { studentId: { in: childIds } },
            orderBy: { session: { scheduledAt: "desc" } },
            take: 6,
            include: { student: true, session: true },
          })
        : Promise.resolve([]),
      childIds.length
        ? prisma.progressReport.findMany({
            where: { studentId: { in: childIds }, sharedWithParent: true },
            orderBy: { updatedAt: "desc" },
            take: 6,
            include: { student: true },
          })
        : Promise.resolve([]),
      prisma.message.findMany({
        where: { recipientId: parentId },
        orderBy: { createdAt: "desc" },
        take: 6,
        include: { sender: true },
      }),
      childIds.length
        ? prisma.mentoringSession.findMany({
            where: {
              status: "SCHEDULED",
              scheduledAt: { gte: now },
              attendance: { some: { studentId: { in: childIds } } },
            },
            orderBy: { scheduledAt: "asc" },
            take: 6,
            include: { attendance: { include: { student: true } } },
          })
        : Promise.resolve([]),
      prisma.announcement.findMany({
        where: { pinned: true, audience: { in: ["ALL", "PARENTS"] } },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
    ]);

  // Average growth score per radar axis across all children.
  const radarData = RADAR_AXES.map(({ axis, category }) => {
    const scores = children
      .flatMap((c) => c.growthRecords)
      .filter((r) => r.category === category && r.score != null)
      .map((r) => r.score as number);
    const avg = scores.length
      ? Math.round(scores.reduce((a, n) => a + n, 0) / scores.length)
      : 0;
    return { axis, Progress: avg };
  });
  const hasGrowth = radarData.some((d) => d.Progress > 0);

  // Build a merged "recent updates" feed, newest first.
  type Update = { id: string; title: string; meta: string; at: Date; dot: string };
  const updates: Update[] = [
    ...recentSessions.map((a) => ({
      id: `att-${a.id}`,
      title: `${a.student.fullName} · ${a.session.title}`,
      meta: `Session ${a.session.status.toLowerCase()} · attendance ${a.status.toLowerCase()}`,
      at: a.session.scheduledAt,
      dot: "#1E50A2",
    })),
    ...sharedReports.map((r) => ({
      id: `rep-${r.id}`,
      title: `New report shared · ${r.student.fullName}`,
      meta: `${r.title}${r.period ? ` · ${r.period}` : ""}`,
      at: r.updatedAt,
      dot: "#2FA84F",
    })),
    ...recentMessages.map((m) => ({
      id: `msg-${m.id}`,
      title: `Message from ${m.sender.name}`,
      meta: m.subject || m.body.slice(0, 60),
      at: m.createdAt,
      dot: "#E0A92E",
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  return (
    <>
      <PageHeader
        title="Parent Dashboard"
        subtitle={`Welcome, ${session.name} · Following your child's journey`}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {/* My Children */}
        <Panel
          title="My Children"
          className="lg:col-span-2"
          action={
            <Link href="/parent/children" className="btn-ghost text-xs">
              View all
            </Link>
          }
        >
          {children.length === 0 ? (
            <EmptyState
              title="No children linked yet"
              hint="Once your application is approved, your child's profile will appear here."
              icon={<Users className="h-8 w-8" />}
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {children.map((c) => (
                <Link
                  key={c.id}
                  href={`/parent/children/${c.id}`}
                  className="flex items-center gap-3 rounded-xl border border-slate-100 p-3 transition hover:border-navy hover:shadow-card"
                >
                  <Avatar name={c.fullName} src={c.photo} size={44} tint="#6d28d9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-navy">{c.fullName}</p>
                    <p className="truncate text-xs text-slate-400">
                      {c.className ?? "—"}
                      {c.mentor ? ` · Mentor: ${c.mentor.name}` : ""}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
                </Link>
              ))}
            </div>
          )}
        </Panel>

        {/* Overall Progress */}
        <Panel title="Overall Progress">
          {hasGrowth ? (
            <SkillRadarChart
              data={radarData}
              series={[{ key: "Progress", label: "Avg Growth", color: "#6d28d9" }]}
            />
          ) : (
            <EmptyState
              title="No growth data yet"
              hint="Mentors will log development across six dimensions."
            />
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Recent Updates */}
        <Panel title="Recent Updates">
          {updates.length === 0 ? (
            <EmptyState
              title="No recent updates"
              hint="Sessions, reports and messages will show here."
            />
          ) : (
            <div className="divide-y divide-slate-50">
              {updates.map((u) => (
                <ActivityItem
                  key={u.id}
                  title={u.title}
                  meta={u.meta}
                  time={timeAgo(u.at)}
                  dot={u.dot}
                />
              ))}
            </div>
          )}
        </Panel>

        {/* Upcoming Events */}
        <Panel title="Upcoming Events">
          {upcomingSessions.length === 0 && announcements.length === 0 ? (
            <EmptyState
              title="Nothing scheduled"
              hint="Upcoming sessions and announcements will appear here."
              icon={<CalendarDays className="h-8 w-8" />}
            />
          ) : (
            <div className="space-y-3">
              {upcomingSessions.map((s) => {
                const mine = s.attendance
                  .filter((a) => childIds.includes(a.studentId))
                  .map((a) => a.student.fullName)
                  .join(", ");
                return (
                  <div key={s.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy-50 text-navy">
                      <CalendarDays className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-700">{s.title}</p>
                        <StatusBadge status={s.status} />
                      </div>
                      <p className="text-xs text-slate-400">{fmtDateTime(s.scheduledAt)}</p>
                      {mine && <p className="truncate text-xs text-slate-400">For: {mine}</p>}
                    </div>
                  </div>
                );
              })}
              {announcements.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                    <Megaphone className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-700">{a.title}</p>
                    <p className="line-clamp-2 text-xs text-slate-400">{a.body}</p>
                    <p className="mt-0.5 text-xs text-slate-400">{fmtDateTime(a.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <QuickLink href="/parent/reports" label="Progress Reports" icon={<FileText className="h-5 w-5" />} />
        <QuickLink href="/parent/assessments" label="Assessments" icon={<FileText className="h-5 w-5" />} />
        <QuickLink href="/parent/messages" label="Messages" icon={<MessageSquare className="h-5 w-5" />} />
        <QuickLink href="/parent/feedback" label="Give Feedback" icon={<MessageSquare className="h-5 w-5" />} />
      </div>
    </>
  );
}

function QuickLink({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-card transition hover:border-navy"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-navy-50 text-navy">{icon}</span>
      <span className="text-sm font-semibold text-slate-700">{label}</span>
    </Link>
  );
}
