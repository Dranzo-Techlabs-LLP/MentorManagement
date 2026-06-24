import {
  Globe,
  Server,
  ShieldCheck,
  Users,
  GraduationCap,
  Contact,
  UserRound,
  Building2,
  FileBarChart,
  CalendarDays,
  FileText,
  KeyRound,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { PageHeader, Badge } from "@/components/ui/primitives";
import { Panel, MiniMetric } from "@/components/dash/widgets";

const DEPLOYMENT_URL = "elevateu.ndhrglobal.com";
const APP_NAME = "Elevate U";

const ROLE_HIERARCHY = [
  { role: "Super Admin", tone: "blue" as const, desc: "Full program control · all institutions & users" },
  { role: "Chief Mentor", tone: "purple" as const, desc: "Oversees supervisors & program quality" },
  { role: "Supervisor", tone: "teal" as const, desc: "Manages a team of mentors" },
  { role: "Mentor", tone: "green" as const, desc: "Guides assigned students 1-to-1" },
  { role: "Parent", tone: "gold" as const, desc: "Tracks their child's progress" },
  { role: "Student", tone: "slate" as const, desc: "Engages with goals, sessions & assessments" },
];

const DEMO_ACCOUNTS = [
  { label: "Super Admin", email: "superadmin@ndhrglobal.com" },
  { label: "Chief Mentor", email: "chief@ndhrglobal.com" },
  { label: "Supervisor", email: "supervisor@ndhrglobal.com" },
  { label: "Mentor", email: "mentor@ndhrglobal.com" },
  { label: "Parent", email: "parent@ndhrglobal.com" },
  { label: "Student", email: "student@ndhrglobal.com" },
];
const DEMO_PASS = "Elevate@123";

export default async function SettingsPage() {
  const [
    students,
    mentors,
    parents,
    users,
    institutions,
    templates,
    assessments,
    sessions,
    reports,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.user.count({ where: { role: "MENTOR" } }),
    prisma.user.count({ where: { role: "PARENT" } }),
    prisma.user.count(),
    prisma.institution.count(),
    prisma.assessmentTemplate.count(),
    prisma.studentAssessment.count(),
    prisma.mentoringSession.count(),
    prisma.progressReport.count(),
  ]);

  const counts = [
    { label: "Total Users", value: users, icon: <Users className="h-4 w-4" /> },
    { label: "Students", value: students, icon: <UserRound className="h-4 w-4" /> },
    { label: "Mentors", value: mentors, icon: <GraduationCap className="h-4 w-4" /> },
    { label: "Parents", value: parents, icon: <Contact className="h-4 w-4" /> },
    { label: "Institutions", value: institutions, icon: <Building2 className="h-4 w-4" /> },
    { label: "Assessment Templates", value: templates, icon: <FileBarChart className="h-4 w-4" /> },
    { label: "Assessments Assigned", value: assessments, icon: <FileBarChart className="h-4 w-4" /> },
    { label: "Mentoring Sessions", value: sessions, icon: <CalendarDays className="h-4 w-4" /> },
    { label: "Progress Reports", value: reports, icon: <FileText className="h-4 w-4" /> },
  ];

  return (
    <>
      <PageHeader title="Program Settings" subtitle="System information, hierarchy & access" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Application">
          <div className="space-y-3 text-sm">
            <Row icon={<Globe className="h-4 w-4" />} label="App name" value={APP_NAME} />
            <Row icon={<Server className="h-4 w-4" />} label="Deployment" value={DEPLOYMENT_URL} />
            <Row icon={<ShieldCheck className="h-4 w-4" />} label="Program" value="SLEP · Student Leadership Empowerment Program" />
            <Row icon={<Contact className="h-4 w-4" />} label="Operated by" value="NDHR Global Solutions" />
          </div>
        </Panel>

        <Panel title="Role Hierarchy" className="lg:col-span-2">
          <div className="space-y-2.5">
            {ROLE_HIERARCHY.map((r, i) => (
              <div key={r.role} className="flex items-center gap-3" style={{ paddingLeft: i * 14 }}>
                <Badge tone={r.tone}>{r.role}</Badge>
                <span className="text-sm text-slate-500">{r.desc}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Reporting chain: Mentor → Supervisor → Chief Mentor. Data access is scoped by this chain.
          </p>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Program Statistics">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {counts.map((c) => (
              <MiniMetric key={c.label} label={c.label} value={c.value} />
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          title={
            <span className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Demo Accounts
            </span>
          }
        >
          <p className="mb-3 text-sm text-slate-500">
            Shared password for all demo logins: <span className="font-semibold text-navy">{DEMO_PASS}</span>
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {DEMO_ACCOUNTS.map((d) => (
              <div key={d.email} className="rounded-xl border border-slate-100 p-4">
                <p className="text-sm font-semibold text-slate-700">{d.label}</p>
                <p className="mt-0.5 text-xs text-slate-500">{d.email}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-2 text-slate-400">
        {icon} {label}
      </span>
      <span className="text-right font-medium text-slate-700">{value}</span>
    </div>
  );
}
