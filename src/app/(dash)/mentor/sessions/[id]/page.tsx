import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Clock, MapPin, Video, Users, ListChecks } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { completeSession } from "@/lib/actions";
import { PageHeader, Avatar, Badge, EmptyState } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton, Field } from "@/components/ui/form";
import { fmtDateTime, titleCase } from "@/lib/utils";

const ATTENDANCE_STATUSES = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

export default async function SessionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { id } = await params;

  const item = await prisma.mentoringSession.findUnique({
    where: { id },
    include: { attendance: { include: { student: true } } },
  });

  if (!item || item.mentorId !== session.userId) {
    return (
      <>
        <Link href="/mentor/sessions" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy">
          <ArrowLeft className="h-4 w-4" /> Back to sessions
        </Link>
        <Panel>
          <EmptyState title="Session not found" hint="This session is not yours, or does not exist." />
        </Panel>
      </>
    );
  }

  const isScheduled = item.status === "SCHEDULED";

  return (
    <>
      <Link href="/mentor/sessions" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Back to sessions
      </Link>

      <PageHeader
        title={item.title}
        subtitle={item.topic ?? "Mentoring session"}
        action={
          <div className="flex items-center gap-2">
            <Badge tone="teal">{titleCase(item.type)}</Badge>
            <StatusBadge status={item.status} />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Panel title="Session Details">
            <div className="grid gap-4 sm:grid-cols-2">
              <Detail icon={<Clock className="h-4 w-4" />} label="Scheduled" value={fmtDateTime(item.scheduledAt)} />
              <Detail icon={<Clock className="h-4 w-4" />} label="Duration" value={item.durationMins ? `${item.durationMins} mins` : "—"} />
              {item.meetingLink && <Detail icon={<Video className="h-4 w-4" />} label="Meeting link" value={item.meetingLink} />}
              {item.location && <Detail icon={<MapPin className="h-4 w-4" />} label="Location" value={item.location} />}
            </div>
            {item.agenda && (
              <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="mb-1 font-semibold text-slate-500">Agenda</p>
                {item.agenda}
              </div>
            )}
          </Panel>

          {!isScheduled && (
            <Panel title="Session Outcome">
              <div className="space-y-4 text-sm">
                <OutcomeBlock label="Observations" value={item.observations} />
                <OutcomeBlock label="Action Points" value={item.actionPoints} />
                <OutcomeBlock label="Parent Note" value={item.parentNote} />
              </div>
            </Panel>
          )}
        </div>

        <Panel title={<span className="flex items-center gap-2"><Users className="h-4 w-4" /> Attendance</span>}>
          {item.attendance.length === 0 ? (
            <p className="text-sm text-slate-400">No attendees on this session.</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {item.attendance.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-2 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Avatar name={a.student.fullName} src={a.student.photo} size={32} />
                    <span className="truncate text-sm font-medium text-slate-700">{a.student.fullName}</span>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {isScheduled && (
        <div className="mt-4">
          <Panel title={<span className="flex items-center gap-2"><ListChecks className="h-4 w-4" /> Complete Session</span>}>
            <ActionForm action={completeSession} className="space-y-4">
              <input type="hidden" name="id" value={item.id} />

              {item.attendance.length > 0 && (
                <Field label="Mark attendance">
                  <div className="grid gap-3 rounded-xl border border-slate-100 p-3 sm:grid-cols-2">
                    {item.attendance.map((a) => (
                      <div key={a.id} className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm text-slate-600">{a.student.fullName}</span>
                        <select name={`att_${a.studentId}`} className="input w-32" defaultValue={a.status}>
                          {ATTENDANCE_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {titleCase(st)}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </Field>
              )}

              <Field label="Observations">
                <textarea name="observations" className="input" rows={3} placeholder="What did you observe during the session?" />
              </Field>
              <Field label="Action Points">
                <textarea name="actionPoints" className="input" rows={3} placeholder="Agreed next steps…" />
              </Field>
              <Field label="Parent Note" hint="Shareable summary for the parent">
                <textarea name="parentNote" className="input" rows={3} placeholder="Note for the parent…" />
              </Field>
              <Field label="Follow-up task" hint="Optional. Creates a task linked to this session.">
                <input name="followUp" className="input" placeholder="e.g. Submit reading log next week" />
              </Field>
              <div className="flex justify-end">
                <SubmitButton className="btn-green">Mark as completed</SubmitButton>
              </div>
            </ActionForm>
          </Panel>
        </div>
      )}
    </>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-slate-400">{icon}</span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="truncate font-medium text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function OutcomeBlock({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="mb-1 font-semibold text-slate-500">{label}</p>
      <p className="text-slate-600">{value || <span className="text-slate-400">—</span>}</p>
    </div>
  );
}
