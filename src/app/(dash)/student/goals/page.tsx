import { redirect } from "next/navigation";
import { Target, Plus } from "lucide-react";
import type { GrowthCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { createGoal, updateGoalProgress } from "@/lib/actions";
import { PageHeader, Progress, EmptyState } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton, Field } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { fmtDate, titleCase } from "@/lib/utils";

const GROWTH_CATEGORIES: GrowthCategory[] = [
  "ACADEMIC",
  "PERSONALITY",
  "LIFE_SKILLS",
  "MORAL_VALUE",
  "HEALTH_WELLBEING",
  "CAREER",
];

export default async function StudentGoalsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await prisma.student.findFirst({
    where: { userId: session.userId },
    include: { goals: { orderBy: { createdAt: "desc" } } },
  });

  if (!student) {
    return (
      <>
        <PageHeader title="My Goals" />
        <Panel>
          <EmptyState title="No student profile linked" hint="Your account isn't linked to a student record yet." icon={<Target className="h-8 w-8" />} />
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="My Goals"
        subtitle="Set targets and track your own progress"
        action={<AddGoalModal studentId={student.id} />}
      />

      <Panel>
        {student.goals.length === 0 ? (
          <EmptyState title="No goals yet" hint="Add your first goal to get started." icon={<Target className="h-8 w-8" />} />
        ) : (
          <div className="space-y-5">
            {student.goals.map((g) => (
              <div key={g.id} className="rounded-xl border border-slate-100 p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-navy">{g.title}</p>
                  <StatusBadge status={g.status} />
                </div>
                {g.description && <p className="mb-2 text-xs text-slate-400">{g.description}</p>}
                <Progress value={g.progress} />
                <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
                  <span>{g.progress}% complete</span>
                  {g.targetDate && <span>Target {fmtDate(g.targetDate)}</span>}
                </div>

                <ActionForm action={updateGoalProgress} className="mt-3 flex items-end gap-2">
                  <input type="hidden" name="id" value={g.id} />
                  <div className="flex-1">
                    <label className="label">Update progress (%)</label>
                    <input
                      name="progress"
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={g.progress}
                      className="input"
                    />
                  </div>
                  <SubmitButton className="btn-outline">Update</SubmitButton>
                </ActionForm>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}

function AddGoalModal({ studentId }: { studentId: string }) {
  return (
    <Modal
      title="Add Goal"
      triggerClassName="btn-primary"
      triggerLabel={<><Plus className="h-4 w-4" /> Add Goal</>}
    >
      <ActionForm action={createGoal} className="space-y-4">
          <input type="hidden" name="studentId" value={studentId} />
          <Field label="Goal title">
            <input name="title" className="input" required placeholder="e.g. Read 12 books this year" />
          </Field>
          <Field label="Description">
            <textarea name="description" className="input" rows={3} placeholder="Details…" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category">
              <select name="category" className="input" defaultValue="">
                <option value="">— None —</option>
                {GROWTH_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {titleCase(c)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Target date">
              <input name="targetDate" type="date" className="input" />
            </Field>
          </div>
          <Field label="Initial progress (%)">
            <input name="progress" type="number" min={0} max={100} className="input" defaultValue={0} />
          </Field>
          <div className="flex justify-end">
            <SubmitButton>Create goal</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}
