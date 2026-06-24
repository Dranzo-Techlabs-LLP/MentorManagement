import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createSession } from "@/lib/actions";
import { PageHeader, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { TabLinks } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton, Field } from "@/components/ui/form";
import { fmtDateTime, titleCase } from "@/lib/utils";

const TABS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "completed", label: "Completed" },
];

const SESSION_TYPES = ["ONLINE", "OFFLINE", "REVIEW"];

export default async function MentorSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const mentorId = session.userId;
  const { tab } = await searchParams;
  const view = tab ?? "upcoming";

  let where: Prisma.MentoringSessionWhereInput = { mentorId };
  let orderBy: Prisma.MentoringSessionOrderByWithRelationInput = { scheduledAt: "desc" };
  if (view === "completed") {
    where = { mentorId, status: "COMPLETED" };
  } else {
    where = { mentorId, status: "SCHEDULED", scheduledAt: { gte: new Date() } };
    orderBy = { scheduledAt: "asc" };
  }

  const [sessions, mentees] = await Promise.all([
    prisma.mentoringSession.findMany({
      where,
      orderBy,
      include: { _count: { select: { attendance: true } } },
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
        title="My Sessions"
        subtitle="Schedule and manage your mentoring sessions"
        action={<ScheduleSessionModal mentorId={mentorId} mentees={mentees} />}
      />

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
                <Link href={`/mentor/sessions/${s.id}`} className="block hover:opacity-80">
                  <p className="font-semibold text-navy">{s.title}</p>
                  {s.topic && <p className="truncate text-xs text-slate-400">{s.topic}</p>}
                </Link>
              ),
            },
            { header: "Type", cell: (s) => <Badge tone="teal">{titleCase(s.type)}</Badge> },
            { header: "Scheduled", cell: (s) => <span className="text-slate-600">{fmtDateTime(s.scheduledAt)}</span> },
            { header: "Attendees", cell: (s) => <span className="font-medium text-slate-600">{s._count.attendance}</span> },
            { header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
          ]}
        />
      </Panel>
    </>
  );
}

function ScheduleSessionModal({
  mentorId,
  mentees,
}: {
  mentorId: string;
  mentees: { id: string; fullName: string }[];
}) {
  return (
    <Modal
      wide
      title="Schedule Session"
      triggerClassName="btn-primary"
      triggerLabel={<><CalendarPlus className="h-4 w-4" /> Schedule Session</>}
    >
      <ActionForm action={createSession} className="space-y-4">
          <input type="hidden" name="mentorId" value={mentorId} />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title">
              <input name="title" className="input" required placeholder="e.g. Goal Review Session" />
            </Field>
            <Field label="Type">
              <select name="type" className="input" defaultValue="ONLINE">
                {SESSION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {titleCase(t)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field label="Topic">
            <input name="topic" className="input" placeholder="e.g. Career planning" />
          </Field>
          <Field label="Agenda">
            <textarea name="agenda" className="input" rows={3} placeholder="What will you cover?" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Scheduled at">
              <input name="scheduledAt" type="datetime-local" className="input" required />
            </Field>
            <Field label="Duration (mins)">
              <input name="durationMins" type="number" min={5} className="input" defaultValue={45} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Meeting link" hint="For online sessions">
              <input name="meetingLink" className="input" placeholder="https://…" />
            </Field>
            <Field label="Location" hint="For in-person sessions">
              <input name="location" className="input" placeholder="Room / venue" />
            </Field>
          </div>
          <Field label="Attendees">
            {mentees.length === 0 ? (
              <p className="text-sm text-slate-400">No mentees assigned yet.</p>
            ) : (
              <div className="grid max-h-44 gap-2 overflow-y-auto rounded-xl border border-slate-100 p-3 sm:grid-cols-2">
                {mentees.map((m) => (
                  <label key={m.id} className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" name="studentIds" value={m.id} className="h-4 w-4 rounded border-slate-300" />
                    {m.fullName}
                  </label>
                ))}
              </div>
            )}
          </Field>
          <div className="flex justify-end">
            <SubmitButton>Schedule session</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}
