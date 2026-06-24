import { UserCog, GraduationCap, UserRound, FileText } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard, Avatar } from "@/components/ui/primitives";
import { Panel, AlertRow } from "@/components/dash/widgets";
import { DonutChart, GroupBarChart } from "@/components/ui/charts";

/**
 * Chief Mentor Dashboard — program-wide overview across all supervisors,
 * mentors, students and institutions.
 */
export default async function ChiefDashboard() {
  const [
    supervisors,
    mentors,
    students,
    pendingReports,
    asmCounts,
    institutions,
    ratings,
    studentsNeedingAttention,
    lowActivityMentors,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "SUPERVISOR" } }),
    prisma.user.count({ where: { role: "MENTOR" } }),
    prisma.student.count(),
    prisma.progressReport.count({ where: { status: "PENDING" } }),
    prisma.studentAssessment.groupBy({ by: ["status"], _count: true }),
    prisma.institution.findMany({
      orderBy: { name: "asc" },
      take: 8,
      include: { _count: { select: { students: true } } },
    }),
    prisma.feedback.groupBy({
      by: ["mentorId"],
      where: { mentorId: { not: null }, rating: { not: null } },
      _avg: { rating: true },
    }),
    prisma.student.count({ where: { status: { in: ["PENDING", "INACTIVE"] } } }),
    prisma.user.count({ where: { role: "MENTOR", mentoredSessions: { none: {} } } }),
  ]);

  const count = (s: string) => asmCounts.find((c) => c.status === s)?._count ?? 0;
  const completed = count("COMPLETED");
  const inProgress = count("IN_PROGRESS");
  const assigned = count("ASSIGNED");
  const totalAsm = completed + inProgress + assigned || 1;
  const completionPct = Math.round((completed / totalAsm) * 100);

  // top mentors by avg rating
  const topMentorIds = ratings
    .filter((r) => r._avg.rating != null)
    .sort((a, b) => (b._avg.rating ?? 0) - (a._avg.rating ?? 0))
    .slice(0, 5);
  const topMentors = topMentorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: topMentorIds.map((r) => r.mentorId!).filter(Boolean) } },
        select: { id: true, name: true, avatar: true },
      })
    : [];
  const ratingMap = new Map(topMentorIds.map((r) => [r.mentorId, r._avg.rating ?? null]));
  const topMentorsSorted = topMentors
    .map((m) => ({ ...m, rating: ratingMap.get(m.id) ?? null }))
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));

  const institutionData = institutions.map((i) => ({ name: i.name, students: i._count.students }));

  return (
    <>
      <PageHeader title="Chief Mentor Dashboard" subtitle="Program-wide overview · SLEP" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Supervisors" value={supervisors} icon={<UserCog className="h-5 w-5" />} tint="#E0A92E" />
        <StatCard label="Mentors" value={mentors} icon={<GraduationCap className="h-5 w-5" />} tint="#2FA84F" />
        <StatCard label="Students" value={students} icon={<UserRound className="h-5 w-5" />} tint="#1E50A2" />
        <StatCard label="Reports Pending" value={pendingReports} icon={<FileText className="h-5 w-5" />} tint="#14A1A8" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Assessment Completion">
          <DonutChart
            centerLabel={`${completionPct}%`}
            data={[
              { name: "Completed", value: completed || 1, color: "#2FA84F" },
              { name: "In Progress", value: inProgress, color: "#14A1A8" },
              { name: "Assigned", value: assigned, color: "#E0A92E" },
            ]}
          />
          <div className="mt-3 space-y-1.5 text-sm">
            <Legend color="#2FA84F" label="Completed" value={completed} />
            <Legend color="#14A1A8" label="In Progress" value={inProgress} />
            <Legend color="#E0A92E" label="Assigned" value={assigned} />
          </div>
        </Panel>

        <Panel title="Institution Overview" className="lg:col-span-2">
          {institutionData.length === 0 ? (
            <p className="py-6 text-sm text-slate-400">No institutions registered yet.</p>
          ) : (
            <GroupBarChart
              data={institutionData}
              series={[{ key: "students", label: "Students", color: "#1E50A2" }]}
            />
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Mentor Performance" className="lg:col-span-2">
          {topMentorsSorted.length === 0 ? (
            <p className="py-6 text-sm text-slate-400">No rated mentors yet.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {topMentorsSorted.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} src={m.avatar} size={36} tint="#2FA84F" />
                    <p className="font-semibold text-slate-700">{m.name}</p>
                  </div>
                  <span className="text-sm font-bold text-navy">
                    {m.rating != null ? `${m.rating.toFixed(1)}/5` : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Alerts">
          <div className="space-y-2">
            <AlertRow text={`${pendingReports} reports pending review`} href="/chief/reports" tone="amber" />
            <AlertRow text={`${studentsNeedingAttention} students need attention`} href="/chief/students" tone="red" />
            <AlertRow text={`${lowActivityMentors} mentors with low activity`} href="/chief/mentors" tone="blue" />
          </div>
        </Panel>
      </div>
    </>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-slate-600">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {label}
      </span>
      <span className="font-semibold text-slate-700">{value}</span>
    </div>
  );
}
