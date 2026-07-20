import Link from "next/link";
import { redirect } from "next/navigation";
import { Pencil, UserPlus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPerms } from "@/lib/permissions";
import { saveStudent, deleteStudent } from "@/lib/actions";
import { PageHeader, Avatar, Progress } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { SubmitButton } from "@/components/ui/form";
import { StudentFormFields } from "../../admin/students/StudentFormFields";
import { CATEGORY_LABEL } from "@/lib/utils";

export default async function MenteesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { q } = await searchParams;
  const perms = await getPerms("students");

  const where: Prisma.StudentWhereInput = {
    mentorId: session.userId,
    ...(q ? { fullName: { contains: q } } : {}),
  };

  const [mentees, institutions, parents, self] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { fullName: "asc" },
      include: {
        growthRecords: { select: { score: true } },
        _count: { select: { assessments: true } },
      },
    }),
    prisma.institution.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: "PARENT" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true } }),
  ]);
  // Scoped to this mentor only — the shared form's "Mentor" select is intentionally
  // limited to themselves (plus Unassigned) so a mentor can't reassign a mentee elsewhere.
  const mentors = self ? [self] : [];

  const withAvg = mentees.map((m) => {
    const scored = m.growthRecords.filter((r) => r.score != null);
    const avg = scored.length ? Math.round(scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length) : 0;
    return { ...m, avg };
  });

  return (
    <>
      <PageHeader
        title="My Mentees"
        subtitle={`${mentees.length} student${mentees.length === 1 ? "" : "s"} under your mentorship`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchBar placeholder="Search mentees" />
            {perms.create && <AddMenteeModal institutions={institutions} mentors={mentors} parents={parents} />}
          </div>
        }
      />

      <Panel>
        <DataTable
          rows={withAvg}
          getKey={(s) => s.id}
          empty="No mentees found."
          columns={[
            {
              header: "Student",
              cell: (s) => (
                <Link href={`/mentor/mentees/${s.id}`} className="flex items-center gap-3 hover:opacity-80">
                  <Avatar name={s.fullName} src={s.photo} size={36} />
                  <div className="min-w-0">
                    <p className="font-semibold text-navy">{s.fullName}</p>
                    {s.rollNo && <p className="truncate text-xs text-slate-400">Roll {s.rollNo}</p>}
                  </div>
                </Link>
              ),
            },
            { header: "Class", cell: (s) => <span className="text-slate-600">{s.className ?? "—"}</span> },
            {
              header: "Level",
              cell: (s) => <span className="text-xs text-slate-500">{s.ageCategory ? CATEGORY_LABEL[s.ageCategory] : "—"}</span>,
            },
            {
              header: "Growth",
              cell: (s) => (
                <div className="flex w-40 items-center gap-2">
                  <Progress value={s.avg} />
                  <span className="shrink-0 text-xs font-semibold text-slate-500">{s.avg}%</span>
                </div>
              ),
            },
            { header: "Assessments", cell: (s) => <span className="font-medium text-slate-600">{s._count.assessments}</span> },
            { header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
            {
              header: "Actions",
              cell: (s) => (
                <div className="flex items-center gap-1">
                  {perms.edit && (
                    <Modal
                      wide
                      title="Edit Mentee"
                      triggerClassName="btn-ghost text-xs"
                      triggerLabel={<><Pencil className="h-3.5 w-3.5" /> Edit</>}
                    >
                      <ActionForm action={saveStudent} className="space-y-4" successMessage="Student updated.">
                        <StudentFormFields student={s} institutions={institutions} mentors={mentors} parents={parents} />
                        <div className="flex justify-end gap-2 pt-2">
                          <SubmitButton>Save changes</SubmitButton>
                        </div>
                      </ActionForm>
                    </Modal>
                  )}
                  {perms.delete && (
                    <ConfirmDeleteButton
                      action={deleteStudent}
                      hiddenFields={{ id: s.id }}
                      itemLabel={s.fullName}
                      warning="This permanently removes the student and all of their growth records, reports, assessments, goals, tasks and documents."
                      successMessage="Student deleted."
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
    </>
  );
}

function AddMenteeModal({
  institutions,
  mentors,
  parents,
}: {
  institutions: { id: string; name: string }[];
  mentors: { id: string; name: string }[];
  parents: { id: string; name: string }[];
}) {
  return (
    <Modal
      wide
      title="Add Student"
      triggerClassName="btn-primary"
      triggerLabel={<><UserPlus className="h-4 w-4" /> Add Student</>}
    >
      <ActionForm action={saveStudent} className="space-y-4" successMessage="Student created.">
        <StudentFormFields institutions={institutions} mentors={mentors} parents={parents} />
        <div className="flex justify-end gap-2 pt-2">
          <SubmitButton>Create student</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}
