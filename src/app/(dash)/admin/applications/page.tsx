import { CheckCircle2, XCircle } from "lucide-react";
import type { Prisma, ApplicationStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { approveApplication, rejectApplication, deleteApplication } from "@/lib/actions";
import { PageHeader } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { TabLinks } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { SubmitButton, Field } from "@/components/ui/form";
import { Pagination } from "@/components/ui/Pagination";
import { fmtDate } from "@/lib/utils";

const TABS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
];

const TAB_STATUS: Record<string, ApplicationStatus | undefined> = {
  pending: "PENDING",
  approved: "APPROVED",
  rejected: "REJECTED",
  all: undefined,
};

const PAGE_SIZE = 10;

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>;
}) {
  const { tab, page: pageParam } = await searchParams;
  const status = TAB_STATUS[tab ?? "pending"];
  const where: Prisma.ParentApplicationWhereInput = status ? { status } : {};
  const page = Math.max(1, Number(pageParam) || 1);

  const [applications, total, mentors, institutions] = await Promise.all([
    prisma.parentApplication.findMany({
      where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    }),
    prisma.parentApplication.count({ where }),
    prisma.user.findMany({ where: { role: "MENTOR" }, orderBy: { name: "asc" } }),
    prisma.institution.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader title="Parent Applications" subtitle="Review and process enrollment requests" />

      <TabLinks tabs={TABS} />

      <Panel>
        <DataTable
          rows={applications}
          getKey={(a) => a.id}
          empty="No applications in this view."
          columns={[
            {
              header: "Applicant",
              cell: (a) => (
                <div className="min-w-0">
                  <p className="font-semibold text-slate-700">{a.parentName}</p>
                  <p className="truncate text-xs text-slate-400">{a.parentEmail}</p>
                </div>
              ),
            },
            {
              header: "Student",
              cell: (a) => (
                <div className="min-w-0">
                  <p className="font-medium text-slate-700">{a.studentName}</p>
                  {a.studentGender && <p className="text-xs text-slate-400">{a.studentGender}</p>}
                </div>
              ),
            },
            { header: "Institution", cell: (a) => <span className="text-slate-600">{a.institutionName ?? "—"}</span> },
            { header: "Class", cell: (a) => <span className="text-slate-600">{a.className ?? "—"}</span> },
            { header: "Date", cell: (a) => <span className="text-slate-500">{fmtDate(a.createdAt)}</span> },
            { header: "Status", cell: (a) => <StatusBadge status={a.status} /> },
            {
              header: "Actions",
              cell: (a) => (
                <div className="flex items-center gap-1.5">
                  {a.status === "PENDING" ? (
                    <>
                      <ApproveModal id={a.id} studentName={a.studentName} mentors={mentors} institutions={institutions} />
                      <RejectModal id={a.id} studentName={a.studentName} />
                    </>
                  ) : (
                    <span className="text-xs text-slate-400">{a.reviewNote ? `Note: ${a.reviewNote}` : "Processed"}</span>
                  )}
                  <ConfirmDeleteButton
                    action={deleteApplication}
                    hiddenFields={{ id: a.id }}
                    itemLabel={`${a.studentName}'s application`}
                    triggerClassName="btn-ghost text-xs text-red-600"
                  />
                </div>
              ),
            },
          ]}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/applications" searchParams={{ tab }} />
      </Panel>
    </>
  );
}

function ApproveModal({
  id,
  studentName,
  mentors,
  institutions,
}: {
  id: string;
  studentName: string;
  mentors: { id: string; name: string }[];
  institutions: { id: string; name: string }[];
}) {
  return (
    <Modal
      title="Approve Application"
      triggerClassName="btn-green text-xs"
      triggerLabel={<><CheckCircle2 className="h-3.5 w-3.5" /> Approve</>}
    >
      <ActionForm action={approveApplication} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <p className="text-sm text-slate-600">
            Approving will create a student record for <span className="font-semibold text-navy">{studentName}</span> and a
            parent account if one does not exist.
          </p>
          <Field label="Assign Mentor">
            <select name="mentorId" className="input" defaultValue="">
              <option value="">— Assign later —</option>
              {mentors.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Institution">
            <select name="institutionId" className="input" defaultValue="">
              <option value="">— None —</option>
              {institutions.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="flex justify-end">
            <SubmitButton className="btn-green">Approve &amp; enroll</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}

function RejectModal({ id, studentName }: { id: string; studentName: string }) {
  return (
    <Modal
      title="Reject Application"
      triggerClassName="btn-outline text-xs text-red-600"
      triggerLabel={<><XCircle className="h-3.5 w-3.5" /> Reject</>}
    >
      <ActionForm action={rejectApplication} className="space-y-4">
          <input type="hidden" name="id" value={id} />
          <p className="text-sm text-slate-600">
            Reject the application for <span className="font-semibold text-navy">{studentName}</span>.
          </p>
          <Field label="Reason / note">
            <textarea name="reviewNote" className="input" rows={3} placeholder="Optional note for records…" />
          </Field>
          <div className="flex justify-end">
            <SubmitButton className="btn-primary bg-red-600 hover:bg-red-700">Reject application</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}
