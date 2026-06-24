import { redirect } from "next/navigation";
import Link from "next/link";
import { Users, UserRound, FileText, CalendarDays, CheckCircle2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { reviewReport } from "@/lib/actions";
import { PageHeader, StatCard, Avatar } from "@/components/ui/primitives";
import { Panel, AlertRow } from "@/components/dash/widgets";
import { GroupBarChart } from "@/components/ui/charts";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/form";
import { titleCase } from "@/lib/utils";

/**
 * Supervisor Dashboard.
 * Scope: the supervisor's own mentors (User.managerId === session.userId, role MENTOR),
 * the students those mentors own, and reports/sessions those mentors generate.
 */
export default async function SupervisorDashboard() {
  const session = await getSession();
  if (!session) redirect("/login");

  // 1. My mentors
  const mentors = await prisma.user.findMany({
    where: { managerId: session.userId, role: "MENTOR" },
    orderBy: { name: "asc" },
    include: { _count: { select: { mentoredSessions: true } } },
  });
  const mentorIds = mentors.map((m) => m.id);

  // 2. Students under those mentors
  const studentIds = mentorIds.length
    ? (
        await prisma.student.findMany({
          where: { mentorId: { in: mentorIds } },
          select: { id: true, status: true },
        })
      ).map((s) => s.id)
    : [];

  // start of the current month for "sessions this month"
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [pendingReports, sessionsThisMonth, ratings, growth, lowActivityMentors] =
    await Promise.all([
      // pending reports submitted by my mentors
      mentorIds.length
        ? prisma.progressReport.findMany({
            where: { status: "PENDING", submittedById: { in: mentorIds } },
            orderBy: { createdAt: "desc" },
            take: 6,
            include: { student: true, submittedBy: true },
          })
        : Promise.resolve([]),
      // sessions by my mentors this month
      mentorIds.length
        ? prisma.mentoringSession.count({
            where: { mentorId: { in: mentorIds }, scheduledAt: { gte: monthStart } },
          })
        : Promise.resolve(0),
      // avg feedback rating per mentor
      mentorIds.length
        ? prisma.feedback.groupBy({
            by: ["mentorId"],
            where: { mentorId: { in: mentorIds }, rating: { not: null } },
            _avg: { rating: true },
          })
        : Promise.resolve([]),
      // avg growth score per category across my students
      studentIds.length
        ? prisma.growthRecord.groupBy({
            by: ["category"],
            where: { studentId: { in: studentIds } },
            _avg: { score: true },
          })
        : Promise.resolve([]),
      // mentors with low session activity (illustrative threshold)
      mentorIds.length
        ? prisma.user.count({
            where: { managerId: session.userId, role: "MENTOR", mentoredSessions: { none: {} } },
          })
        : Promise.resolve(0),
    ]);

  const pendingReportCount = mentorIds.length
    ? await prisma.progressReport.count({
        where: { status: "PENDING", submittedById: { in: mentorIds } },
      })
    : 0;

  const ratingMap = new Map(ratings.map((r) => [r.mentorId, r._avg.rating ?? null]));

  // mockup category mapping
  const avg = (cat: string) => Math.round(growth.find((g) => g.category === cat)?._avg.score ?? 0);
  const progressData = [
    { name: "Academic", score: avg("ACADEMIC") },
    { name: "Leadership", score: avg("LIFE_SKILLS") },
    { name: "Character", score: avg("MORAL_VALUE") },
    { name: "Life Skills", score: avg("PERSONALITY") },
    { name: "Spiritual", score: avg("HEALTH_WELLBEING") },
  ];

  const studentsNeedingAttention = studentIds.length
    ? await prisma.student.count({
        where: { id: { in: studentIds }, status: { in: ["PENDING", "INACTIVE"] } },
      })
    : 0;

  return (
    <>
      <PageHeader title="Supervisor Dashboard" subtitle={`Mentor team overview · ${session.name}`} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Mentors" value={mentors.length} icon={<Users className="h-5 w-5" />} tint="#E0A92E" />
        <StatCard label="Mentees" value={studentIds.length} icon={<UserRound className="h-5 w-5" />} tint="#1E50A2" />
        <StatCard label="Reports Pending" value={pendingReportCount} icon={<FileText className="h-5 w-5" />} tint="#14A1A8" />
        <StatCard label="Sessions This Month" value={sessionsThisMonth} icon={<CalendarDays className="h-5 w-5" />} tint="#2FA84F" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Mentor Performance" className="lg:col-span-2">
          {mentors.length === 0 ? (
            <p className="py-6 text-sm text-slate-400">No mentors assigned to you yet.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {mentors.map((m) => {
                const r = ratingMap.get(m.id);
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={m.name} src={m.avatar} size={36} tint="#2FA84F" />
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-700">{m.name}</p>
                        <p className="truncate text-xs text-slate-400">
                          {m._count.mentoredSessions} session{m._count.mentoredSessions === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-navy">
                      {r != null ? `${r.toFixed(1)}/5` : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel
          title="Reports to Review"
          action={
            <Link href="/supervisor/reports" className="text-xs font-semibold text-navy hover:underline">
              View All
            </Link>
          }
        >
          {pendingReports.length === 0 ? (
            <p className="py-6 text-sm text-slate-400">No reports awaiting review.</p>
          ) : (
            <div className="space-y-3">
              {pendingReports.map((rep) => (
                <div key={rep.id} className="rounded-xl border border-slate-100 p-3">
                  <p className="text-sm font-semibold text-slate-700">{rep.student.fullName}</p>
                  <p className="text-xs text-slate-400">
                    {titleCase(rep.type)} · {rep.submittedBy?.name ?? "—"}
                  </p>
                  <ActionForm action={reviewReport} className="mt-2">
                    <input type="hidden" name="id" value={rep.id} />
                    <SubmitButton className="btn-green text-xs" pendingText="…">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Review
                    </SubmitButton>
                  </ActionForm>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Student Progress Overview" className="lg:col-span-2">
          <GroupBarChart
            data={progressData}
            series={[{ key: "score", label: "Avg Score", color: "#1E50A2" }]}
          />
        </Panel>

        <Panel title="Alerts">
          <div className="space-y-2">
            <AlertRow text={`${pendingReportCount} reports pending review`} href="/supervisor/reports" tone="amber" />
            <AlertRow text={`${studentsNeedingAttention} students need attention`} href="/supervisor/students" tone="red" />
            <AlertRow text={`${lowActivityMentors} mentors with low activity`} href="/supervisor/mentors" tone="blue" />
          </div>
        </Panel>
      </div>
    </>
  );
}
