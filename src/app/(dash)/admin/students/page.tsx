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
import { SubmitButton, Field } from "@/components/ui/form";
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
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input name="fullName" className="input" required placeholder="Muhammed Sinan" />
            </Field>
            <Field label="Gender">
              <select name="gender" className="input" defaultValue="">
                <option value="">— Select —</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </Field>
            <Field label="Date of birth">
              <input name="dob" type="date" className="input" />
            </Field>
            <Field label="Class / Grade">
              <input name="className" className="input" placeholder="Grade 9" />
            </Field>
            <Field label="Email">
              <input name="email" type="email" className="input" placeholder="student@example.com" />
            </Field>
            <Field label="Phone">
              <input name="phone" className="input" placeholder="+91 98470 00000" />
            </Field>
            <Field label="Address">
              <input name="address" className="input" placeholder="City, State" />
            </Field>
            <Field label="Interests">
              <input name="interests" className="input" placeholder="Robotics, Football, Reading" />
            </Field>
            <Field label="Talents">
              <input name="talents" className="input" placeholder="Public speaking, Coding" />
            </Field>
            <Field label="Institution">
              <select name="institutionId" className="input" defaultValue="">
                <option value="">— None —</option>
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Mentor">
              <select name="mentorId" className="input" defaultValue="">
                <option value="">— Unassigned —</option>
                {mentors.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Parent / Guardian">
              <select name="parentId" className="input" defaultValue="">
                <option value="">— None —</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <SubmitButton>Create student</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}
