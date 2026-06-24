import { Users, GraduationCap, Contact, CalendarDays, UserPlus, FileCheck2, ClipboardCheck } from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard } from "@/components/ui/primitives";
import { Panel, MiniMetric, ActivityItem, AlertRow, trendSeries } from "@/components/dash/widgets";
import { TrendLineChart, DonutChart } from "@/components/ui/charts";
import { timeAgo } from "@/lib/utils";

export default async function AdminDashboard() {
  const [students, mentors, parents, activeSessions, asmCounts, growth, recentLogs, pendingReports, lowActivity, recentUsers] =
    await Promise.all([
      prisma.student.count(),
      prisma.user.count({ where: { role: "MENTOR" } }),
      prisma.user.count({ where: { role: "PARENT" } }),
      prisma.mentoringSession.count({ where: { status: "SCHEDULED" } }),
      prisma.studentAssessment.groupBy({ by: ["status"], _count: true }),
      prisma.growthRecord.groupBy({ by: ["category"], _avg: { score: true } }),
      prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 5, include: { user: true } }),
      prisma.progressReport.count({ where: { status: "PENDING" } }),
      prisma.student.count({ where: { status: "ACTIVE" } }),
      prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 4, where: { role: { in: ["MENTOR", "PARENT", "STUDENT"] } } }),
    ]);

  const asm = (s: string) => asmCounts.find((c) => c.status === s)?._count ?? 0;
  const totalAsm = asmCounts.reduce((a, c) => a + (c._count as number), 0) || 1;
  const completed = asm("COMPLETED");
  const inProgress = asm("IN_PROGRESS");
  const pending = asm("ASSIGNED");
  const completionPct = Math.round((completed / totalAsm) * 100);

  const avg = (cat: string) => Math.round(growth.find((g) => g.category === cat)?._avg.score ?? 60);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
  const trendData = months.map((m, i) => ({
    name: m,
    Academic: trendSeries(avg("ACADEMIC"))[i].value,
    Leadership: trendSeries(avg("LIFE_SKILLS"))[i].value,
    Character: trendSeries(avg("MORAL_VALUE"))[i].value,
    "Life Skills": trendSeries(avg("PERSONALITY"))[i].value,
  }));

  return (
    <>
      <PageHeader title="Super Admin Dashboard" subtitle="Program-wide overview · NDHR Global" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Students" value={students} delta="+12.5% from last month" icon={<Users className="h-5 w-5" />} tint="#1E50A2" />
        <StatCard label="Total Mentors" value={mentors} delta="+8.3% from last month" icon={<GraduationCap className="h-5 w-5" />} tint="#2FA84F" />
        <StatCard label="Total Parents" value={parents} delta="+10.2% from last month" icon={<Contact className="h-5 w-5" />} tint="#6d28d9" />
        <StatCard label="Active Sessions" value={activeSessions} delta="+15.6% from last month" icon={<CalendarDays className="h-5 w-5" />} tint="#E0A92E" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Student Growth Overview" className="lg:col-span-2">
          <TrendLineChart
            data={trendData}
            series={[
              { key: "Academic", label: "Academic" },
              { key: "Leadership", label: "Leadership" },
              { key: "Character", label: "Character" },
              { key: "Life Skills", label: "Life Skills" },
            ]}
          />
        </Panel>
        <Panel title="Aptitude Assessment Overview">
          <DonutChart
            centerLabel={`${completionPct}%`}
            data={[
              { name: "Completed", value: completed || 1, color: "#1E50A2" },
              { name: "In Progress", value: inProgress, color: "#14A1A8" },
              { name: "Pending", value: pending, color: "#E0A92E" },
            ]}
          />
          <div className="mt-3 space-y-1.5 text-sm">
            <Legend color="#1E50A2" label="Completed" value={completed} />
            <Legend color="#14A1A8" label="In Progress" value={inProgress} />
            <Legend color="#E0A92E" label="Pending" value={pending} />
          </div>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel title="Reports Snapshot" className="lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MiniMetric label="Mentor Performance" value="85%" sub="Average Rating" />
            <MiniMetric label="Student Engagement" value="78%" sub="Active Participation" />
            <MiniMetric label="Parent Engagement" value="72%" sub="Feedback Rate" />
            <MiniMetric label="Assessment Completion" value={`${completionPct}%`} sub="This Month" />
          </div>
          <h4 className="mb-1 mt-5 text-sm font-semibold text-slate-500">Recently Added</h4>
          <div className="divide-y divide-slate-50">
            {recentUsers.map((usr) => (
              <ActivityItem key={usr.id} title={`${usr.name} · ${usr.role.replace("_", " ").toLowerCase()}`} meta={usr.email} time={timeAgo(usr.createdAt)} dot="#2FA84F" />
            ))}
          </div>
        </Panel>

        <div className="space-y-4">
          <Panel title="Recent Activities">
            <div className="divide-y divide-slate-50">
              {recentLogs.length === 0 ? (
                <p className="py-4 text-sm text-slate-400">No recent activity.</p>
              ) : (
                recentLogs.map((l) => (
                  <ActivityItem key={l.id} title={`${l.action} · ${l.entity ?? ""}`} meta={l.user?.name ?? "System"} time={timeAgo(l.createdAt)} />
                ))
              )}
            </div>
          </Panel>
          <Panel title="Alerts & Notifications">
            <div className="space-y-2">
              <AlertRow text={`${pendingReports} mentor reports pending review`} href="/admin/reports" tone="amber" />
              <AlertRow text={`${lowActivity} students active in program`} href="/admin/students" tone="blue" />
            </div>
          </Panel>
        </div>
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
