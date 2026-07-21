import { redirect } from "next/navigation";
import type { Prisma, SessionType } from "@prisma/client";
import { Pencil } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPerms } from "@/lib/permissions";
import { ROLE_HOME } from "@/lib/rbac";
import { updateSession, deleteSession } from "@/lib/actions";
import { PageHeader, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { TabLinks } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { SubmitButton, Field } from "@/components/ui/form";
import { Pagination } from "@/components/ui/Pagination";
import { fmtDateTime, titleCase } from "@/lib/utils";

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
];

const SESSION_TYPES: SessionType[] = ["ONLINE", "OFFLINE", "REVIEW"];
const PAGE_SIZE = 10;

const dtLocalValue = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/**
 * Mentoring sessions — shared by every workspace that can be granted the
 * `sessions` resource. Role decides the data window:
 *   Super Admin / Chief Mentor → program-wide
 *   Supervisor                 → sessions run by their mentor team
 *   Mentor                     → their own sessions
 */
async function scopeFor(userId: string, role: string): Promise<Prisma.MentoringSessionWhereInput> {
  if (role === "SUPER_ADMIN" || role === "CHIEF_MENTOR") return {};
  if (role === "SUPERVISOR") {
    const mentorIds = (
      await prisma.user.findMany({ where: { managerId: userId, role: "MENTOR" }, select: { id: true } })
    ).map((m) => m.id);
    return { mentorId: { in: mentorIds.length ? mentorIds : ["__none__"] } };
  }
  return { mentorId: userId };
}

export async function SessionsView({
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

  const perms = await getPerms("sessions");
  if (!perms.view) redirect(ROLE_HOME[session.role]);

  const view = tab ?? "upcoming";
  const scope = await scopeFor(session.userId, session.role);

  let where: Prisma.MentoringSessionWhereInput = scope;
  let orderBy: Prisma.MentoringSessionOrderByWithRelationInput = { scheduledAt: "desc" };
  if (view === "upcoming") {
    where = { ...scope, status: "SCHEDULED", scheduledAt: { gte: new Date() } };
    orderBy = { scheduledAt: "asc" };
  } else if (view === "completed") {
    where = { ...scope, status: "COMPLETED" };
  }

  const [sessions, total] = await Promise.all([
    prisma.mentoringSession.findMany({
      where, orderBy, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { mentor: true, _count: { select: { attendance: true } } },
    }),
    prisma.mentoringSession.count({ where }),
  ]);

  return (
    <>
      <PageHeader title="Mentoring Sessions" subtitle="Schedule of one-to-one and group sessions" />

      <TabLinks tabs={TABS} />

      <Panel>
        <DataTable
          rows={sessions}
          getKey={(s) => s.id}
          empty="No sessions in this view."
          columns={[
            {
              header: "Session",
              cell: (s) => (
                <div className="min-w-0">
                  <p className="font-semibold text-slate-700">{s.title}</p>
                  {s.topic && <p className="truncate text-xs text-slate-400">{s.topic}</p>}
                </div>
              ),
            },
            { header: "Mentor", cell: (s) => <span className="text-slate-600">{s.mentor.name}</span> },
            { header: "Type", cell: (s) => <Badge tone="teal">{titleCase(s.type)}</Badge> },
            { header: "Scheduled", cell: (s) => <span className="text-slate-600">{fmtDateTime(s.scheduledAt)}</span> },
            {
              header: "Attendees",
              cell: (s) => <span className="font-medium text-slate-600">{s._count.attendance}</span>,
            },
            { header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
            {
              header: "Actions",
              cell: (s) => (
                <div className="flex items-center gap-1">
                  {perms.edit && <EditSessionModal session={s} />}
                  {perms.delete && (
                    <ConfirmDeleteButton
                      action={deleteSession}
                      hiddenFields={{ id: s.id }}
                      itemLabel={s.title}
                      warning="This permanently removes the session and its attendance records. This cannot be undone."
                      successMessage="Session deleted."
                      triggerClassName="btn-ghost text-xs text-red-600"
                    />
                  )}
                  {!perms.edit && !perms.delete && <span className="text-xs text-slate-300">—</span>}
                </div>
              ),
            },
          ]}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath={basePath} searchParams={{ tab }} />
      </Panel>
    </>
  );
}

export function EditSessionModal({
  session,
}: {
  session: {
    id: string; title: string; type: SessionType; topic: string | null; agenda: string | null;
    scheduledAt: Date; durationMins: number | null; meetingLink: string | null; location: string | null;
  };
}) {
  return (
    <Modal title="Edit Session" triggerClassName="btn-ghost text-xs" triggerLabel={<><Pencil className="h-3.5 w-3.5" /> Edit</>}>
      <ActionForm action={updateSession} className="space-y-4" successMessage="Session updated.">
        <input type="hidden" name="id" value={session.id} />
        <Field label="Title">
          <input name="title" className="input" required defaultValue={session.title} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type">
            <select name="type" className="input" defaultValue={session.type}>
              {SESSION_TYPES.map((t) => <option key={t} value={t}>{titleCase(t)}</option>)}
            </select>
          </Field>
          <Field label="Scheduled at">
            <input name="scheduledAt" type="datetime-local" className="input" defaultValue={dtLocalValue(new Date(session.scheduledAt))} />
          </Field>
          <Field label="Duration (mins)">
            <input name="durationMins" type="number" min={5} className="input" defaultValue={session.durationMins ?? 45} />
          </Field>
          <Field label="Location">
            <input name="location" className="input" defaultValue={session.location ?? ""} />
          </Field>
        </div>
        <Field label="Topic">
          <input name="topic" className="input" defaultValue={session.topic ?? ""} />
        </Field>
        <Field label="Meeting link">
          <input name="meetingLink" className="input" defaultValue={session.meetingLink ?? ""} placeholder="https://…" />
        </Field>
        <Field label="Agenda">
          <textarea name="agenda" className="input" rows={3} defaultValue={session.agenda ?? ""} />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Save changes</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}
