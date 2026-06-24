import { redirect } from "next/navigation";
import { FilePlus2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { assignAssessment } from "@/lib/actions";
import { PageHeader, Avatar, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton, Field } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fmtDate, titleCase } from "@/lib/utils";

export default async function MentorAssessmentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const mentorId = session.userId;

  const [assessments, mentees, templates] = await Promise.all([
    prisma.studentAssessment.findMany({
      where: { student: { mentorId } },
      orderBy: { createdAt: "desc" },
      include: { student: true, template: true },
    }),
    prisma.student.findMany({
      where: { mentorId },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
    prisma.assessmentTemplate.findMany({
      where: { isActive: true },
      orderBy: { title: "asc" },
      select: { id: true, title: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Assessments"
        subtitle="Aptitude & discovery assessments assigned to your mentees"
        action={<AssignAssessmentModal mentees={mentees} templates={templates} />}
      />

      <Panel>
        <DataTable
          rows={assessments}
          getKey={(a) => a.id}
          empty="No assessments assigned yet."
          columns={[
            {
              header: "Student",
              cell: (a) => (
                <div className="flex items-center gap-3">
                  <Avatar name={a.student.fullName} src={a.student.photo} size={32} />
                  <span className="font-semibold text-slate-700">{a.student.fullName}</span>
                </div>
              ),
            },
            { header: "Assessment", cell: (a) => <span className="text-slate-600">{a.template.title}</span> },
            { header: "Category", cell: (a) => <Badge tone="purple">{titleCase(a.template.category)}</Badge> },
            { header: "Status", cell: (a) => <StatusBadge status={a.status} /> },
            {
              header: "Score",
              cell: (a) => (a.score != null ? <span className="font-bold text-navy">{a.score}%</span> : <span className="text-xs text-slate-400">—</span>),
            },
            { header: "Completed", cell: (a) => <span className="text-slate-600">{a.completedAt ? fmtDate(a.completedAt) : "—"}</span> },
          ]}
        />
      </Panel>
    </>
  );
}

function AssignAssessmentModal({
  mentees,
  templates,
}: {
  mentees: { id: string; fullName: string }[];
  templates: { id: string; title: string }[];
}) {
  return (
    <Modal
      title="Assign Assessment"
      triggerClassName="btn-primary"
      triggerLabel={<><FilePlus2 className="h-4 w-4" /> Assign Assessment</>}
    >
      <ActionForm action={assignAssessment} className="space-y-4">
          <Field label="Student">
            <select name="studentId" className="input" required defaultValue="">
              <option value="" disabled>
                Select a mentee…
              </option>
              {mentees.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.fullName}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assessment template">
            <select name="templateId" className="input" required defaultValue="">
              <option value="" disabled>
                Select a template…
              </option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end">
            <SubmitButton>Assign</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}
