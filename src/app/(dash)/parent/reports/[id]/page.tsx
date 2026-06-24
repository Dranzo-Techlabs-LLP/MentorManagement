import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, FileX } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { EmptyState, Progress } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Logo } from "@/components/brand/Logo";
import { fmtDate, titleCase, ageFromDob } from "@/lib/utils";
import { PrintButton } from "../PrintButton";

type ReportContent = {
  academic?: number;
  leadership?: number;
  character?: number;
  lifeSkills?: number;
  spiritual?: number;
};

const DIMENSIONS: { key: keyof ReportContent; label: string; color: string }[] = [
  { key: "academic", label: "Academic", color: "#1E50A2" },
  { key: "leadership", label: "Leadership", color: "#2FA84F" },
  { key: "character", label: "Character", color: "#E0A92E" },
  { key: "lifeSkills", label: "Life Skills", color: "#14A1A8" },
  { key: "spiritual", label: "Spiritual", color: "#6d28d9" },
];

export default async function ParentReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const report = await prisma.progressReport.findUnique({
    where: { id },
    include: {
      student: { include: { mentor: true, institution: true } },
      submittedBy: true,
    },
  });

  // Guard: parent must own the child and the report must be shared.
  if (!report || report.student.parentId !== session.userId || !report.sharedWithParent) {
    return (
      <>
        <Link href="/parent/reports" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy">
          <ArrowLeft className="h-4 w-4" /> Back to reports
        </Link>
        <Panel>
          <EmptyState
            title="Report unavailable"
            hint="This report is not shared with your account, or does not exist."
            icon={<FileX className="h-8 w-8" />}
          />
        </Panel>
      </>
    );
  }

  const content = (report.content as ReportContent | null) ?? {};
  const dims = DIMENSIONS.map((d) => ({ ...d, value: Number(content[d.key] ?? 0) }));
  const student = report.student;
  const age = ageFromDob(student.dob);

  return (
    <>
      <div className="no-print mb-3 flex items-center justify-between gap-3">
        <Link href="/parent/reports" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy">
          <ArrowLeft className="h-4 w-4" /> Back to reports
        </Link>
        <PrintButton />
      </div>

      {/* Printable sheet */}
      <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-8 shadow-card print:border-0 print:shadow-none">
        {/* Brand header */}
        <div className="flex items-start justify-between border-b border-slate-100 pb-5">
          <div>
            <Logo />
            <p className="mt-1 text-xs font-medium text-slate-500">An Initiative of NDHR Global Solutions</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Progress Report</p>
            <p className="text-sm font-bold text-navy">{titleCase(report.type)}</p>
            {report.period && <p className="text-xs text-slate-500">{report.period}</p>}
          </div>
        </div>

        {/* Student header */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <h1 className="text-2xl font-extrabold text-navy">{report.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {student.fullName}
              {student.className ? ` · ${student.className}` : ""}
              {age != null ? ` · Age ${age}` : ""}
            </p>
            {student.institution && (
              <p className="text-xs text-slate-400">{student.institution.name}</p>
            )}
          </div>
          <div className="sm:text-right">
            <DetailLine label="Mentor" value={student.mentor?.name ?? report.submittedBy?.name ?? "—"} />
            <DetailLine label="Report date" value={fmtDate(report.createdAt)} />
            <div className="mt-1 inline-block">
              <StatusBadge status={report.status} />
            </div>
          </div>
        </div>

        {/* Dimension scores */}
        <div className="mt-6">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Development Dimensions</h2>
          <div className="space-y-3">
            {dims.map((d) => (
              <div key={d.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{d.label}</span>
                  <span className="font-bold text-navy">{d.value}%</span>
                </div>
                <Progress value={d.value} color={d.color} />
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        {report.summary && (
          <div className="mt-6">
            <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">Mentor's Summary</h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{report.summary}</p>
          </div>
        )}

        {/* Footer / signature */}
        <div className="mt-8 flex items-end justify-between border-t border-slate-100 pt-5 text-xs text-slate-400">
          <div>
            <p className="font-semibold text-slate-600">{student.mentor?.name ?? report.submittedBy?.name ?? "SLEP Mentor"}</p>
            <p>Mentor · SLEP</p>
          </div>
          <p>Elevate U · Mentoring Management Portal</p>
        </div>
      </div>
    </>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm text-slate-500">
      <span className="text-slate-400">{label}: </span>
      <span className="font-medium text-slate-700">{value}</span>
    </p>
  );
}
