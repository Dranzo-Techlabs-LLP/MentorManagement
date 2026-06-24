import { UserPlus, Power } from "lucide-react";
import type { Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { saveUser, setUserStatus } from "@/lib/actions";
import { PageHeader, Avatar } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { SearchBar } from "@/components/ui/SearchBar";
import { TabLinks } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton, Field } from "@/components/ui/form";
import { fmtDate, titleCase } from "@/lib/utils";

const ROLES: Role[] = ["SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR", "MENTOR", "PARENT", "STUDENT"];

const TAB_ROLES: Record<string, Role[]> = {
  all: ROLES,
  staff: ["SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR", "MENTOR"],
  parents: ["PARENT"],
  students: ["STUDENT"],
};

const TABS = [
  { key: "all", label: "All Users" },
  { key: "staff", label: "Staff" },
  { key: "parents", label: "Parents" },
  { key: "students", label: "Students" },
];

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string }>;
}) {
  const { q, tab } = await searchParams;
  const roleGroup = TAB_ROLES[tab ?? "all"] ?? TAB_ROLES.all;

  const where: Prisma.UserWhereInput = {
    role: { in: roleGroup },
    ...(q
      ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] }
      : {}),
  };

  const [users, institutions, managers] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { institution: true },
    }),
    prisma.institution.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: { in: ["CHIEF_MENTOR", "SUPERVISOR"] } },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <PageHeader
        title="Users Management"
        subtitle="All accounts across the program · staff, parents & students"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchBar placeholder="Search name or email" />
            <AddUserModal institutions={institutions} managers={managers} />
          </div>
        }
      />

      <TabLinks tabs={TABS} />

      <Panel>
        <DataTable
          rows={users}
          getKey={(u) => u.id}
          empty="No users found."
          columns={[
            {
              header: "Name",
              cell: (u) => (
                <div className="flex items-center gap-3">
                  <Avatar name={u.name} src={u.avatar} size={36} />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-700">{u.name}</p>
                    {u.title && <p className="truncate text-xs text-slate-400">{u.title}</p>}
                  </div>
                </div>
              ),
            },
            { header: "Email", cell: (u) => <span className="text-slate-600">{u.email}</span> },
            { header: "Role", cell: (u) => <span className="font-medium text-slate-600">{titleCase(u.role)}</span> },
            { header: "Institution", cell: (u) => <span className="text-slate-600">{u.institution?.name ?? "—"}</span> },
            { header: "Status", cell: (u) => <StatusBadge status={u.status} /> },
            { header: "Created", cell: (u) => <span className="text-slate-500">{fmtDate(u.createdAt)}</span> },
            {
              header: "Actions",
              cell: (u) => (
                <ActionForm action={setUserStatus} className="inline-flex">
                  <input type="hidden" name="id" value={u.id} />
                  <input type="hidden" name="status" value={u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} />
                  <SubmitButton
                    className={u.status === "ACTIVE" ? "btn-ghost text-red-600" : "btn-ghost text-leaf-700"}
                    pendingText="…"
                  >
                    <Power className="h-4 w-4" />
                    {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                  </SubmitButton>
                </ActionForm>
              ),
            },
          ]}
        />
      </Panel>
    </>
  );
}

function AddUserModal({
  institutions,
  managers,
}: {
  institutions: { id: string; name: string }[];
  managers: { id: string; name: string; role: Role }[];
}) {
  return (
    <Modal
      title="Add User"
      triggerClassName="btn-primary"
      triggerLabel={<><UserPlus className="h-4 w-4" /> Add User</>}
    >
      <ActionForm action={saveUser} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input name="name" className="input" required placeholder="Jane Doe" />
            </Field>
            <Field label="Email">
              <input name="email" type="email" className="input" required placeholder="jane@ndhrglobal.com" />
            </Field>
            <Field label="Role">
              <select name="role" className="input" required defaultValue="MENTOR">
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {titleCase(r)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title / Designation">
              <input name="title" className="input" placeholder="Mentor" />
            </Field>
            <Field label="Phone">
              <input name="phone" className="input" placeholder="+91 98470 00000" />
            </Field>
            <Field label="Temporary password" hint="Defaults to Elevate@123 if left blank.">
              <input name="password" className="input" placeholder="Elevate@123" />
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
            <Field label="Reports to (Manager)">
              <select name="managerId" className="input" defaultValue="">
                <option value="">— None —</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {titleCase(m.role)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <SubmitButton>Create user</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}
