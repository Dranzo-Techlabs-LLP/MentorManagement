import { FileBarChart, ClipboardList, CheckCircle2, Plus, Pencil, Power } from "lucide-react";
import type { AssessmentTemplate, AssessmentLevel, AssessmentCategory } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPerms } from "@/lib/permissions";
import { saveAssessmentTemplate, setTemplateActive, deleteAssessmentTemplate } from "@/lib/actions";
import { PageHeader, StatCard, Badge, Avatar } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { DonutChart } from "@/components/ui/charts";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { SubmitButton, Field } from "@/components/ui/form";
import { CATEGORY_LABEL, fmtDate, titleCase } from "@/lib/utils";

const LEVELS: AssessmentLevel[] = ["LEVEL_1", "LEVEL_2", "LEVEL_3", "GENERAL"];
const CATEGORIES: AssessmentCategory[] = [
  "SELF_DISCOVERY", "TALENT_DISCOVERY", "CAREER_APTITUDE", "MULTIPLE_INTELLIGENCE",
  "LEARNING_STYLE", "PERSONALITY", "STRENGTH", "LEADERSHIP",
];

export default async function AssessmentsPage() {
  const perms = await getPerms("assessments");
  const [templates, statusCounts, recentCompleted, totalAssigned] = await Promise.all([
    prisma.assessmentTemplate.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { instances: true } } },
    }),
    prisma.studentAssessment.groupBy({ by: ["status"], _count: true }),
    prisma.studentAssessment.findMany({
      where: { status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
      take: 10,
      include: { student: true, template: true },
    }),
    prisma.studentAssessment.count(),
  ]);

  const count = (s: string) => statusCounts.find((c) => c.status === s)?._count ?? 0;
  const completed = count("COMPLETED");
  const inProgress = count("IN_PROGRESS");
  const assigned = count("ASSIGNED");
  const total = completed + inProgress + assigned || 1;
  const completionPct = Math.round((completed / total) * 100);

  return (
    <>
      <PageHeader title="Assessment Framework" subtitle="Psychometric & aptitude assessment library and results" />

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Assessment Status">
          <DonutChart
            centerLabel={`${completionPct}%`}
            data={[
              { name: "Completed", value: completed || 1, color: "#2FA84F" },
              { name: "In Progress", value: inProgress, color: "#14A1A8" },
              { name: "Assigned", value: assigned, color: "#E0A92E" },
            ]}
          />
          <div className="mt-3 space-y-1.5 text-sm">
            <Legend color="#2FA84F" label="Completed" value={completed} />
            <Legend color="#14A1A8" label="In Progress" value={inProgress} />
            <Legend color="#E0A92E" label="Assigned" value={assigned} />
          </div>
        </Panel>

        <div className="grid content-start gap-4 lg:col-span-2 sm:grid-cols-3">
          <StatCard label="Templates" value={templates.length} icon={<FileBarChart className="h-5 w-5" />} tint="#1E50A2" />
          <StatCard label="Assigned" value={totalAssigned} icon={<ClipboardList className="h-5 w-5" />} tint="#E0A92E" />
          <StatCard label="Completed" value={completed} icon={<CheckCircle2 className="h-5 w-5" />} tint="#2FA84F" />
        </div>
      </div>

      <div className="mt-4">
        <Panel title="Assessment Templates" action={perms.create ? <TemplateModal /> : undefined}>
          <DataTable
            rows={templates}
            getKey={(t) => t.id}
            empty="No assessment templates."
            columns={[
              {
                header: "Title",
                cell: (t) => (
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-700">{t.title}</p>
                    {!t.isActive && <span className="text-xs text-slate-400">Inactive</span>}
                  </div>
                ),
              },
              {
                header: "Level",
                cell: (t) => (
                  <span className="text-xs text-slate-500">
                    {t.level === "GENERAL" ? "General" : CATEGORY_LABEL[t.level] ?? titleCase(t.level)}
                  </span>
                ),
              },
              { header: "Category", cell: (t) => <Badge tone="purple">{titleCase(t.category)}</Badge> },
              {
                header: "Age range",
                cell: (t) =>
                  t.ageMin != null || t.ageMax != null ? (
                    <span className="text-slate-600">
                      {t.ageMin ?? "?"}–{t.ageMax ?? "?"}
                    </span>
                  ) : (
                    <span className="text-slate-400">Any</span>
                  ),
              },
              {
                header: "Duration",
                cell: (t) => <span className="text-slate-600">{t.durationMins ? `${t.durationMins} min` : "—"}</span>,
              },
              {
                header: "Instances",
                cell: (t) => <span className="font-medium text-slate-600">{t._count.instances}</span>,
              },
              {
                header: "Actions",
                cell: (t) => (
                  <div className="flex items-center gap-1">
                    {perms.edit && (
                      <>
                        <TemplateModal template={t} />
                        <ActionForm action={setTemplateActive} className="inline-flex">
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="isActive" value={t.isActive ? "false" : "true"} />
                          <SubmitButton className={t.isActive ? "btn-ghost text-xs text-red-600" : "btn-ghost text-xs text-leaf-700"} pendingText="…">
                            <Power className="h-3.5 w-3.5" /> {t.isActive ? "Deactivate" : "Activate"}
                          </SubmitButton>
                        </ActionForm>
                      </>
                    )}
                    {perms.delete && (
                      <ConfirmDeleteButton
                        action={deleteAssessmentTemplate}
                        hiddenFields={{ id: t.id }}
                        itemLabel={t.title}
                        warning={
                          t._count.instances > 0
                            ? `${t._count.instances} student assessment(s) use this template and must be cleared first — deletion will be blocked until then.`
                            : "This is permanent and cannot be undone."
                        }
                        triggerClassName="btn-ghost text-xs text-red-600"
                      />
                    )}
                    {!perms.edit && !perms.delete && <span className="text-xs text-slate-300">—</span>}
                  </div>
                ),
              },
            ]}
          />
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Recent Completed Assessments">
          <DataTable
            rows={recentCompleted}
            getKey={(a) => a.id}
            empty="No completed assessments yet."
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
              {
                header: "Score",
                cell: (a) => (
                  <span className="font-bold text-navy">{a.score != null ? `${a.score}%` : "—"}</span>
                ),
              },
              { header: "Completed", cell: (a) => <span className="text-slate-500">{fmtDate(a.completedAt)}</span> },
            ]}
          />
        </Panel>
      </div>
    </>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-slate-600">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} /> {label}
      </span>
      <span className="font-semibold text-slate-700">{value}</span>
    </div>
  );
}

function TemplateModal({ template }: { template?: AssessmentTemplate }) {
  const questionsStr = template ? JSON.stringify(template.questions, null, 2) : "";
  const scoringStr = template?.scoring ? JSON.stringify(template.scoring, null, 2) : "";
  return (
    <Modal
      wide
      title={template ? "Edit Assessment Template" : "Add Assessment Template"}
      triggerClassName={template ? "btn-ghost text-xs" : "btn-primary"}
      triggerLabel={template ? <><Pencil className="h-3.5 w-3.5" /> Edit</> : <><Plus className="h-4 w-4" /> Add Template</>}
    >
      <ActionForm action={saveAssessmentTemplate} className="space-y-4" successMessage={template ? "Template updated." : "Template created."}>
        {template && <input type="hidden" name="id" value={template.id} />}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Title">
            <input name="title" className="input" required defaultValue={template?.title ?? ""} placeholder="Multiple Intelligence Inventory" />
          </Field>
          <Field label="Category">
            <select name="category" className="input" defaultValue={template?.category ?? "PERSONALITY"}>
              {CATEGORIES.map((c) => <option key={c} value={c}>{titleCase(c)}</option>)}
            </select>
          </Field>
          <Field label="Level">
            <select name="level" className="input" defaultValue={template?.level ?? "GENERAL"}>
              {LEVELS.map((l) => <option key={l} value={l}>{l === "GENERAL" ? "General" : titleCase(l)}</option>)}
            </select>
          </Field>
          <Field label="Duration (mins)">
            <input name="durationMins" type="number" min={1} className="input" defaultValue={template?.durationMins ?? ""} placeholder="30" />
          </Field>
          <Field label="Min age">
            <input name="ageMin" type="number" min={0} className="input" defaultValue={template?.ageMin ?? ""} placeholder="10" />
          </Field>
          <Field label="Max age">
            <input name="ageMax" type="number" min={0} className="input" defaultValue={template?.ageMax ?? ""} placeholder="18" />
          </Field>
        </div>
        <Field label="Description">
          <textarea name="description" className="input" rows={2} defaultValue={template?.description ?? ""} />
        </Field>
        <Field
          label="Questions (JSON array)"
          hint='e.g. [{"id":"q1","text":"I enjoy solving puzzles","options":[{"label":"Strongly agree","value":5,"score":5,"trait":"logical"}]}]'
        >
          <textarea name="questions" className="input font-mono text-xs" rows={8} defaultValue={questionsStr} placeholder="[]" />
        </Field>
        <Field label="Scoring / interpretation bands (JSON, optional)">
          <textarea name="scoring" className="input font-mono text-xs" rows={3} defaultValue={scoringStr} />
        </Field>
        <div className="flex justify-end">
          <SubmitButton>{template ? "Save changes" : "Create template"}</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}
