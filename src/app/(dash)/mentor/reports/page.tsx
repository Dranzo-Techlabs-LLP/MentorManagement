import { redirect } from "next/navigation";
import { FilePlus2, Share2, Check } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createReport, shareReport } from "@/lib/actions";
import { PageHeader, Avatar, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton, Field } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { titleCase } from "@/lib/utils";

const REPORT_TYPES = ["MONTHLY", "QUARTERLY", "ANNUAL", "ASSESSMENT", "SESSION"];

export default async function MentorReportsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const mentorId = session.userId;

  const [reports, mentees] = await Promise.all([
    prisma.progressReport.findMany({
      where: { submittedById: mentorId },
      orderBy: { createdAt: "desc" },
      include: { student: true },
    }),
    prisma.student.findMany({
      where: { mentorId },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Progress Reports"
        subtitle="Reports you have submitted for your mentees"
        action={<NewReportModal mentees={mentees} />}
      />

      <Panel>
        <DataTable
          rows={reports}
          getKey={(r) => r.id}
          empty="You haven't created any reports yet."
          columns={[
            {
              header: "Student",
              cell: (r) => (
                <div className="flex items-center gap-3">
                  <Avatar name={r.student.fullName} src={r.student.photo} size={32} />
                  <span className="font-semibold text-slate-700">{r.student.fullName}</span>
                </div>
              ),
            },
            { header: "Title", cell: (r) => <span className="text-slate-600">{r.title}</span> },
            { header: "Type", cell: (r) => <span className="font-medium text-slate-600">{titleCase(r.type)}</span> },
            { header: "Period", cell: (r) => <span className="text-slate-600">{r.period ?? "—"}</span> },
            { header: "Status", cell: (r) => <StatusBadge status={r.status} /> },
            {
              header: "Shared",
              cell: (r) =>
                r.sharedWithParent ? (
                  <Badge tone="green">
                    <Check className="h-3 w-3" /> Shared
                  </Badge>
                ) : (
                  <Badge tone="slate">Not shared</Badge>
                ),
            },
            {
              header: "Actions",
              cell: (r) =>
                r.sharedWithParent ? (
                  <span className="text-xs text-slate-400">—</span>
                ) : (
                  <ActionForm action={shareReport} className="inline-flex">
                    <input type="hidden" name="id" value={r.id} />
                    <SubmitButton className="btn-outline text-xs" pendingText="…">
                      <Share2 className="h-3.5 w-3.5" /> Share with Parent
                    </SubmitButton>
                  </ActionForm>
                ),
            },
          ]}
        />
      </Panel>
    </>
  );
}

function NewReportModal({ mentees }: { mentees: { id: string; fullName: string }[] }) {
  return (
    <Modal
      wide
      title="New Progress Report"
      triggerClassName="btn-primary"
      triggerLabel={<><FilePlus2 className="h-4 w-4" /> New Report</>}
    >
      <ActionForm action={createReport} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
            <Field label="Type">
              <select name="type" className="input" defaultValue="MONTHLY">
                {REPORT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {titleCase(t)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title">
              <input name="title" className="input" required placeholder="e.g. June Monthly Report" />
            </Field>
            <Field label="Period">
              <input name="period" className="input" placeholder="e.g. June 2026 / Q2 2026" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Field label="Academic">
              <input name="academic" type="number" min={0} max={100} className="input" defaultValue={0} />
            </Field>
            <Field label="Leadership">
              <input name="leadership" type="number" min={0} max={100} className="input" defaultValue={0} />
            </Field>
            <Field label="Character">
              <input name="character" type="number" min={0} max={100} className="input" defaultValue={0} />
            </Field>
            <Field label="Life Skills">
              <input name="lifeSkills" type="number" min={0} max={100} className="input" defaultValue={0} />
            </Field>
            <Field label="Spiritual">
              <input name="spiritual" type="number" min={0} max={100} className="input" defaultValue={0} />
            </Field>
          </div>
          <Field label="Summary">
            <textarea name="summary" className="input" rows={4} placeholder="Narrative summary of progress…" />
          </Field>
          <Field label="Status">
            <select name="status" className="input" defaultValue="PENDING">
              <option value="DRAFT">Save as Draft</option>
              <option value="PENDING">Submit for Review</option>
            </select>
          </Field>
          <div className="flex justify-end">
            <SubmitButton>Save report</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}
