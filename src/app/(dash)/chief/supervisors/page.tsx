import { redirect } from "next/navigation";
import { UserPlus, Pencil } from "lucide-react";
import type { Prisma, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPerms } from "@/lib/permissions";
import { saveUser, deleteUser } from "@/lib/actions";
import { PageHeader, Avatar, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { SubmitButton, Field } from "@/components/ui/form";

/** All supervisors with their team size and the students their teams mentor. */
export default async function ChiefSupervisorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { q } = await searchParams;
  const perms = await getPerms("users");

  const where: Prisma.UserWhereInput = {
    role: "SUPERVISOR",
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
  };

  const [supervisors, institutions] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        institution: true,
        // mentors that report to this supervisor
        reports: { where: { role: "MENTOR" }, select: { id: true } },
      },
    }),
    prisma.institution.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  // students mentored by each supervisor's mentor team
  const allMentorIds = supervisors.flatMap((s) => s.reports.map((m) => m.id));
  const studentsByMentor = allMentorIds.length
    ? await prisma.student.groupBy({
        by: ["mentorId"],
        where: { mentorId: { in: allMentorIds } },
        _count: true,
      })
    : [];
  const studentCountByMentor = new Map(studentsByMentor.map((g) => [g.mentorId, g._count]));
  const studentsForSupervisor = (mentorIds: string[]) =>
    mentorIds.reduce((sum, id) => sum + (studentCountByMentor.get(id) ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Supervisors"
        subtitle="Supervisors and the mentor teams they lead"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchBar placeholder="Search supervisors" />
            {perms.create && <SupervisorModal institutions={institutions} />}
          </div>
        }
      />

      <Panel>
        <DataTable
          rows={supervisors}
          getKey={(s) => s.id}
          empty="No supervisors found."
          columns={[
            {
              header: "Supervisor",
              cell: (s) => (
                <div className="flex items-center gap-3">
                  <Avatar name={s.name} src={s.avatar} size={36} tint="#E0A92E" />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-700">{s.name}</p>
                    <p className="truncate text-xs text-slate-400">{s.email}</p>
                  </div>
                </div>
              ),
            },
            { header: "Institution", cell: (s) => <span className="text-slate-600">{s.institution?.name ?? "—"}</span> },
            { header: "Team Size", cell: (s) => <Badge tone="green">{s.reports.length}</Badge> },
            {
              header: "Students",
              cell: (s) => (
                <Badge tone="blue">{studentsForSupervisor(s.reports.map((m) => m.id))}</Badge>
              ),
            },
            { header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
            {
              header: "Actions",
              cell: (s) => (
                <div className="flex items-center gap-1">
                  {perms.edit && <SupervisorModal supervisor={s} institutions={institutions} />}
                  {perms.delete && (
                    <ConfirmDeleteButton
                      action={deleteUser}
                      hiddenFields={{ id: s.id }}
                      itemLabel={s.name}
                      warning={
                        s.reports.length > 0
                          ? `${s.reports.length} mentor(s) currently report to this supervisor — they will lose this supervisor link. This is permanent.`
                          : "This is permanent and cannot be undone."
                      }
                      successMessage="Supervisor deleted."
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

function SupervisorModal({
  supervisor,
  institutions,
}: {
  supervisor?: User;
  institutions: { id: string; name: string }[];
}) {
  return (
    <Modal
      title={supervisor ? "Edit Supervisor" : "Add Supervisor"}
      triggerClassName={supervisor ? "btn-ghost text-xs" : "btn-primary"}
      triggerLabel={supervisor ? <><Pencil className="h-3.5 w-3.5" /> Edit</> : <><UserPlus className="h-4 w-4" /> Add Supervisor</>}
    >
      <ActionForm action={saveUser} className="space-y-4" successMessage={supervisor ? "Supervisor updated." : "Supervisor created."}>
        {supervisor && <input type="hidden" name="id" value={supervisor.id} />}
        <input type="hidden" name="role" value="SUPERVISOR" />
        <Field label="Full name">
          <input name="name" className="input" required defaultValue={supervisor?.name ?? ""} placeholder="Jane Doe" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" className="input" required defaultValue={supervisor?.email ?? ""} placeholder="jane@ndhrglobal.com" />
        </Field>
        <Field label="Phone">
          <input name="phone" className="input" defaultValue={supervisor?.phone ?? ""} placeholder="+91 98470 00000" />
        </Field>
        <Field label="Title / Designation">
          <input name="title" className="input" defaultValue={supervisor?.title ?? ""} placeholder="Mentoring Supervisor" />
        </Field>
        <Field label="Institution">
          <select name="institutionId" className="input" defaultValue={supervisor?.institutionId ?? ""}>
            <option value="">— None —</option>
            {institutions.map((i) => (
              <option key={i.id} value={i.id}>{i.name}</option>
            ))}
          </select>
        </Field>
        {!supervisor && (
          <Field label="Temporary password" hint="Defaults to Elevate@123 if left blank.">
            <input name="password" className="input" placeholder="Elevate@123" />
          </Field>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <SubmitButton>{supervisor ? "Save changes" : "Create supervisor"}</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}
