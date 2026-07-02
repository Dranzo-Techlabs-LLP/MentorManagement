import Link from "next/link";
import { UserPlus } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { saveStudent } from "@/lib/actions";
import { PageHeader, Avatar } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/form";
import { StudentFormFields } from "./StudentFormFields";
import { CATEGORY_LABEL } from "@/lib/utils";

export default async function StudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const where: Prisma.StudentWhereInput = q ? { fullName: { contains: q } } : {};

  const [students, institutions, mentors, parents] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { institution: true, mentor: true },
    }),
    prisma.institution.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: "MENTOR" }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { role: "PARENT" }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <PageHeader
        title="Students"
        subtitle="All enrolled students in the Leadership Empowerment Program"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchBar placeholder="Search students" />
            <AddStudentModal institutions={institutions} mentors={mentors} parents={parents} />
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
                <Link href={`/admin/students/${s.id}`} className="flex items-center gap-3 hover:opacity-80">
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
              cell: (s) => (
                <span className="text-xs text-slate-500">
                  {s.ageCategory ? CATEGORY_LABEL[s.ageCategory] : "—"}
                </span>
              ),
            },
            { header: "Institution", cell: (s) => <span className="text-slate-600">{s.institution?.name ?? "—"}</span> },
            { header: "Mentor", cell: (s) => <span className="text-slate-600">{s.mentor?.name ?? "—"}</span> },
            { header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
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
      <ActionForm action={saveStudent} className="space-y-4">
          <StudentFormFields institutions={institutions} mentors={mentors} parents={parents} />
          <div className="flex justify-end gap-2 pt-2">
            <SubmitButton>Create student</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}
