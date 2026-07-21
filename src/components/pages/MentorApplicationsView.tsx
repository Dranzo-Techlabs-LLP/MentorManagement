import { redirect } from "next/navigation";
import type { MentorAppStatus } from "@prisma/client";
import { CalendarClock, X } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPerms } from "@/lib/permissions";
import { ROLE_HOME } from "@/lib/rbac";
import { moveMentorToInterview, approveMentorApplication, rejectMentorApplication, deleteMentorApplication } from "@/lib/actions";
import { PageHeader, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { TabLinks } from "@/components/ui/Tabs";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { SubmitButton, Field } from "@/components/ui/form";
import { Pagination } from "@/components/ui/Pagination";
import { fmtDate, titleCase } from "@/lib/utils";

const PAGE_SIZE = 10;

const TABS = [
  { key: "APPLIED", label: "Applied" },
  { key: "INTERVIEW", label: "Interview" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
];

const STATUS_TONE: Record<MentorAppStatus, "blue" | "gold" | "green" | "red"> = {
  APPLIED: "blue", INTERVIEW: "gold", APPROVED: "green", REJECTED: "red",
};

const STATUSES: MentorAppStatus[] = ["APPLIED", "INTERVIEW", "APPROVED", "REJECTED"];

/**
 * Mentor recruitment pipeline — shared by every workspace that can be granted
 * the `mentor_applications` resource. Program-wide intake records with no
 * per-user scoping, so the permission matrix is the only gate.
 */
export async function MentorApplicationsView({
  basePath,
  page,
  tab,
}: {
  basePath: string;
  page: number;
  tab?: string;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const perms = await getPerms("mentor_applications");
  if (!perms.view) redirect(ROLE_HOME[session.role]);

  const status = (STATUSES.includes(tab as MentorAppStatus) ? tab : "APPLIED") as MentorAppStatus;

  const [apps, total] = await Promise.all([
    prisma.mentorApplication.findMany({
      where: { status }, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
    }),
    prisma.mentorApplication.count({ where: { status } }),
  ]);

  return (
    <>
      <PageHeader
        title="Mentor Applications"
        subtitle="Review CVs, interview candidates & add mentors to the resource pool"
      />
      <TabLinks tabs={TABS} />

      <div className="space-y-4">
        {apps.length === 0 ? (
          <Panel>
            <p className="py-8 text-center text-sm text-slate-400">No applications in this stage.</p>
          </Panel>
        ) : (
          apps.map((a) => (
            <Panel key={a.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-navy">{a.name}</h3>
                    <Badge tone={STATUS_TONE[a.status]}>{titleCase(a.status)}</Badge>
                  </div>
                  <p className="text-sm text-slate-500">
                    {a.email}
                    {a.phone ? ` · ${a.phone}` : ""}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    {a.preferredMode && <Badge tone="teal">{titleCase(a.preferredMode)}</Badge>}
                    {a.city && <span>📍 {a.city}</span>}
                    {a.languages && <span>🗣 {a.languages}</span>}
                    {a.timezone && <span>🕑 {a.timezone}</span>}
                    {a.exposure && <span>🌍 {a.exposure}</span>}
                  </div>
                  {a.qualifications && (
                    <p className="mt-2 text-sm text-slate-600">
                      <span className="font-semibold text-slate-500">Qualifications:</span> {a.qualifications}
                    </p>
                  )}
                  {a.experience && (
                    <p className="mt-1 text-sm text-slate-600">
                      <span className="font-semibold text-slate-500">Experience:</span> {a.experience}
                    </p>
                  )}
                  {a.cv && (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer font-semibold text-slate-500">CV / summary</summary>
                      <p className="mt-1 whitespace-pre-wrap text-slate-600">{a.cv}</p>
                    </details>
                  )}
                  {a.cvFileUrl && (
                    <a href={a.cvFileUrl} target="_blank" rel="noreferrer" className="btn-ghost mt-2 text-xs">
                      Open CV file
                    </a>
                  )}
                  {a.interviewNote && (
                    <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs text-slate-600">
                      <span className="font-semibold">Interview note:</span> {a.interviewNote}
                    </p>
                  )}
                  <p className="mt-2 text-xs text-slate-400">Applied {fmtDate(a.createdAt)}</p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {a.status !== "APPROVED" && a.status !== "REJECTED" && perms.edit && (
                    <>
                      {a.status === "APPLIED" && <InterviewModal id={a.id} />}
                      <ApproveForm id={a.id} />
                      <RejectModal id={a.id} />
                    </>
                  )}
                  {perms.delete && (
                    <ConfirmDeleteButton
                      action={deleteMentorApplication}
                      hiddenFields={{ id: a.id }}
                      itemLabel={`${a.name}'s application`}
                      successMessage="Application deleted."
                      triggerClassName="btn-ghost text-xs text-red-600"
                    />
                  )}
                </div>
              </div>
            </Panel>
          ))
        )}
      </div>
      <Panel>
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath={basePath} searchParams={{ tab }} />
      </Panel>
    </>
  );
}

function InterviewModal({ id }: { id: string }) {
  return (
    <Modal
      title="Move to Interview"
      triggerClassName="btn-outline text-xs"
      triggerLabel={<><CalendarClock className="h-3.5 w-3.5" /> Interview</>}
    >
      <ActionForm action={moveMentorToInterview} className="space-y-4" successMessage="Moved to interview.">
        <input type="hidden" name="id" value={id} />
        <Field label="Interview note" hint="Optional — schedule, panel, notes.">
          <textarea name="interviewNote" className="input" rows={3} placeholder="Interview scheduled for…" />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Move to interview</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}

function ApproveForm({ id }: { id: string }) {
  return (
    <ActionForm action={approveMentorApplication} className="inline-flex" successMessage="Mentor added to the pool.">
      <input type="hidden" name="id" value={id} />
      <SubmitButton className="btn-green text-xs" pendingText="Approving…">
        Approve → Pool
      </SubmitButton>
    </ActionForm>
  );
}

function RejectModal({ id }: { id: string }) {
  return (
    <Modal
      title="Reject Application"
      triggerClassName="btn-ghost text-xs text-red-600"
      triggerLabel={<><X className="h-3.5 w-3.5" /> Reject</>}
    >
      <ActionForm action={rejectMentorApplication} className="space-y-4" successMessage="Application rejected.">
        <input type="hidden" name="id" value={id} />
        <Field label="Reason (optional)">
          <textarea name="interviewNote" className="input" rows={3} placeholder="Reason for rejection…" />
        </Field>
        <div className="flex justify-end">
          <SubmitButton className="btn-primary">Reject application</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}
