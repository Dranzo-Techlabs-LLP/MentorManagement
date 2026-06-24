import { redirect } from "next/navigation";
import { ListPlus, Check, Circle } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createTask, toggleTask } from "@/lib/actions";
import { PageHeader, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton, Field } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fmtDate } from "@/lib/utils";

export default async function MentorTasksPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const mentorId = session.userId;

  const [tasks, mentees] = await Promise.all([
    prisma.task.findMany({
      where: {
        OR: [{ createdById: mentorId }, { student: { mentorId } }],
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: { student: true },
    }),
    prisma.student.findMany({
      where: { mentorId },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true },
    }),
  ]);

  const open = tasks.filter((t) => t.status !== "DONE").length;

  return (
    <>
      <PageHeader
        title="Tasks & Follow-ups"
        subtitle={`${open} open task${open === 1 ? "" : "s"}`}
        action={<AddTaskModal mentees={mentees} />}
      />

      <Panel>
        <DataTable
          rows={tasks}
          getKey={(t) => t.id}
          empty="No tasks yet."
          columns={[
            {
              header: "Task",
              cell: (t) => (
                <div className="min-w-0">
                  <p className={t.status === "DONE" ? "font-medium text-slate-400 line-through" : "font-semibold text-slate-700"}>
                    {t.title}
                  </p>
                  {t.description && <p className="truncate text-xs text-slate-400">{t.description}</p>}
                </div>
              ),
            },
            { header: "Mentee", cell: (t) => <span className="text-slate-600">{t.student?.fullName ?? "—"}</span> },
            { header: "Due", cell: (t) => <span className="text-slate-600">{t.dueDate ? fmtDate(t.dueDate) : "—"}</span> },
            {
              header: "Priority",
              cell: (t) => (t.priority ? <Badge tone="slate">{t.priority}</Badge> : <span className="text-xs text-slate-400">—</span>),
            },
            { header: "Status", cell: (t) => <StatusBadge status={t.status} /> },
            {
              header: "",
              cell: (t) => (
                <ActionForm action={toggleTask} className="inline-flex">
                  <input type="hidden" name="id" value={t.id} />
                  {t.status === "DONE" ? (
                    <SubmitButton className="btn-ghost text-xs" pendingText="…">
                      <Circle className="h-3.5 w-3.5" /> Reopen
                    </SubmitButton>
                  ) : (
                    <SubmitButton className="btn-green text-xs" pendingText="…">
                      <Check className="h-3.5 w-3.5" /> Mark done
                    </SubmitButton>
                  )}
                </ActionForm>
              ),
            },
          ]}
        />
      </Panel>
    </>
  );
}

function AddTaskModal({ mentees }: { mentees: { id: string; fullName: string }[] }) {
  return (
    <Modal
      title="Add Task"
      triggerClassName="btn-primary"
      triggerLabel={<><ListPlus className="h-4 w-4" /> Add Task</>}
    >
      <ActionForm action={createTask} className="space-y-4">
          <Field label="Title">
            <input name="title" className="input" required placeholder="e.g. Follow up on reading goal" />
          </Field>
          <Field label="Description">
            <textarea name="description" className="input" rows={3} placeholder="Details…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mentee">
              <select name="studentId" className="input" defaultValue="">
                <option value="">— None —</option>
                {mentees.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.fullName}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Due date">
              <input name="dueDate" type="date" className="input" />
            </Field>
          </div>
          <div className="flex justify-end">
            <SubmitButton>Add task</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}
