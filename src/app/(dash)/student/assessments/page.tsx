import Link from "next/link";
import { redirect } from "next/navigation";
import { FileBarChart, Play, Eye } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fmtDate, titleCase } from "@/lib/utils";

export default async function StudentAssessmentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await prisma.student.findFirst({
    where: { userId: session.userId },
    select: { id: true },
  });

  if (!student) {
    return (
      <>
        <PageHeader title="Assessments" />
        <Panel>
          <EmptyState title="No student profile linked" hint="Your account isn't linked to a student record yet." icon={<FileBarChart className="h-8 w-8" />} />
        </Panel>
      </>
    );
  }

  const assessments = await prisma.studentAssessment.findMany({
    where: { studentId: student.id },
    orderBy: { createdAt: "desc" },
    include: { template: true },
  });

  return (
    <>
      <PageHeader title="My Assessments" subtitle="Discover your strengths, talents and aptitudes" />

      <Panel>
        {assessments.length === 0 ? (
          <EmptyState title="No assessments assigned" hint="Your mentor will assign assessments for you to take." icon={<FileBarChart className="h-8 w-8" />} />
        ) : (
          <DataTable
            rows={assessments}
            getKey={(a) => a.id}
            columns={[
              { header: "Assessment", cell: (a) => <span className="font-semibold text-navy">{a.template.title}</span> },
              { header: "Category", cell: (a) => titleCase(a.template.category) },
              { header: "Status", cell: (a) => <StatusBadge status={a.status} /> },
              {
                header: "Score",
                cell: (a) => (a.score != null ? <span className="font-bold text-navy">{a.score}%</span> : "—"),
              },
              { header: "Date", cell: (a) => (a.completedAt ? fmtDate(a.completedAt) : fmtDate(a.createdAt)) },
              {
                header: "",
                className: "text-right",
                cell: (a) =>
                  a.status === "COMPLETED" ? (
                    <Link href={`/student/assessments/${a.id}`} className="btn-outline text-xs">
                      <Eye className="h-3.5 w-3.5" /> View result
                    </Link>
                  ) : (
                    <Link href={`/student/assessments/${a.id}`} className="btn-primary text-xs">
                      <Play className="h-3.5 w-3.5" /> Take
                    </Link>
                  ),
              },
            ]}
          />
        )}
      </Panel>
    </>
  );
}
