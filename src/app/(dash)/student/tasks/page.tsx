import { redirect } from "next/navigation";
import { ListChecks, Check } from "lucide-react";
import type { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { toggleTask } from "@/lib/actions";
import { PageHeader, EmptyState, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { ActionForm } from "@/components/ui/ActionForm";
import { fmtDate, titleCase } from "@/lib/utils";

const GROUPS: { status: TaskStatus; tone: "gold" | "blue" | "green" }[] = [
  { status: "PENDING", tone: "gold" },
  { status: "IN_PROGRESS", tone: "blue" },
  { status: "DONE", tone: "green" },
];

export default async function StudentTasksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await prisma.student.findFirst({
    where: { userId: session.userId },
    select: { id: true },
  });

  if (!student) {
    return (
      <>
        <PageHeader title="My Tasks" />
        <Panel>
          <EmptyState title="No student profile linked" hint="Your account isn't linked to a student record yet." icon={<ListChecks className="h-8 w-8" />} />
        </Panel>
      </>
    );
  }

  const tasks = await prisma.task.findMany({
    where: { OR: [{ assignedToId: session.userId }, { studentId: student.id }] },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  return (
    <>
      <PageHeader title="My Tasks" subtitle="Stay on top of your follow-ups" />

      {tasks.length === 0 ? (
        <Panel>
          <EmptyState title="No tasks assigned" hint="Tasks from your mentor will appear here." icon={<ListChecks className="h-8 w-8" />} />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {GROUPS.map(({ status, tone }) => {
            const group = tasks.filter((t) => t.status === status);
            return (
              <Panel
                key={status}
                title={
                  <span className="flex items-center gap-2">
                    {titleCase(status)} <Badge tone={tone}>{group.length}</Badge>
                  </span>
                }
              >
                {group.length === 0 ? (
                  <p className="py-6 text-center text-sm text-slate-400">Nothing here.</p>
                ) : (
                  <div className="space-y-2.5">
                    {group.map((t) => {
                      const done = t.status === "DONE";
                      return (
                        <div key={t.id} className="flex items-start gap-3 rounded-xl border border-slate-100 p-3">
                          <ActionForm action={toggleTask}>
                            <input type="hidden" name="id" value={t.id} />
                            <button
                              type="submit"
                              className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-md border transition ${
                                done
                                  ? "border-leaf bg-leaf text-white"
                                  : "border-slate-300 text-transparent hover:border-leaf hover:text-leaf"
                              }`}
                              title={done ? "Mark not done" : "Mark done"}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                          </ActionForm>
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm font-semibold ${done ? "text-slate-400 line-through" : "text-slate-700"}`}>
                              {t.title}
                            </p>
                            {t.description && <p className="text-xs text-slate-400">{t.description}</p>}
                            {t.dueDate && <p className="mt-0.5 text-xs text-slate-400">Due {fmtDate(t.dueDate)}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}
    </>
  );
}
