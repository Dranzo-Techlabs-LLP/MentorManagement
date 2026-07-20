import { redirect } from "next/navigation";
import { Pencil, UserPlus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPerms } from "@/lib/permissions";
import { saveStudent, deleteStudent } from "@/lib/actions";
import { PageHeader, Avatar } from "@/components/ui/primitives";
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

/** All students enrolled in the program. */
export default async function ChiefStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { q } = await searchParams;
  const perms = await getPerms("students");

  const where: Prisma.StudentWhereInput = q ? { fullName: { contains: q } } : {};

  const [students, institutions, mentors, parents] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { fullName: "asc" },
      include: { mentor: true, institution: true },
    }),
    prisma.institution.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: "MENTOR" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: "PARENT" }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Students"
        subtitle="All students enrolled in the program"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchBar placeholder="Search students" />
            {perms.create && <AddStudentModal institutions={institutions} mentors={mentors} parents={parents} />}
          </div>
        }
      />

      <Panel>
        <DataTable
          rows={students}
          getKey={(s) => s.id}
          empty="No students found."
          columns={[
            {
              header: "Student",
              cell: (s) => (
                <div className="flex items-center gap-3">
                  <Avatar name={s.fullName} src={s.photo} size={36} />
                  <div className="min-w-0">
                    <p className="font-semibold text-navy">{s.fullName}</p>
                    {s.rollNo && <p className="truncate text-xs text-slate-400">Roll {s.rollNo}</p>}
                  </div>
                </div>
              ),
            },
            { header: "Class", cell: (s) => <span className="text-slate-600">{s.className ?? "—"}</span> },
            {
              header: "Level",
              cell: (s) => (
                <span className="text-xs text-slate-500">
                  {s.ageCategory ? CATEGORY_LABEL[s.ageCategory] : "—"}
                </span>
              ),
            },
            { header: "Mentor", cell: (s) => <span className="text-slate-600">{s.mentor?.name ?? "—"}</span> },
            { header: "Institution", cell: (s) => <span className="text-slate-600">{s.institution?.name ?? "—"}</span> },
            { header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
            {
              header: "Actions",
              cell: (s) => (
                <div className="flex items-center gap-1">
                  {perms.edit && (
                    <Modal
                      wide
                      title="Edit Student"
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

function AddStudentModal({
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
