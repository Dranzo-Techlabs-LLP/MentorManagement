import { UserPlus, Power, Pencil } from "lucide-react";
import type { Prisma, Role, User } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPerms } from "@/lib/permissions";
import { saveUser, setUserStatus, deleteUser } from "@/lib/actions";
import { PageHeader, Avatar } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { SearchBar } from "@/components/ui/SearchBar";
import { TabLinks } from "@/components/ui/Tabs";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { SubmitButton, Field } from "@/components/ui/form";
import { Pagination } from "@/components/ui/Pagination";
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

const PAGE_SIZE = 10;

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; page?: string }>;
}) {
  const { q, tab, page: pageParam } = await searchParams;
  const roleGroup = TAB_ROLES[tab ?? "all"] ?? TAB_ROLES.all;
  const page = Math.max(1, Number(pageParam) || 1);
  const perms = await getPerms("users");

  const where: Prisma.UserWhereInput = {
    role: { in: roleGroup },
    ...(q
      ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] }
      : {}),
  };

  const [users, total, institutions, managers, appRoles] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { institution: true, appRole: { select: { id: true, name: true } } },
    }),
    prisma.user.count({ where }),
    prisma.institution.findMany({ orderBy: { name: "asc" } }),
    prisma.user.findMany({
      where: { role: { in: ["CHIEF_MENTOR", "SUPERVISOR"] } },
      orderBy: { name: "asc" },
    }),
    prisma.appRole.findMany({ orderBy: [{ isSystem: "desc" }, { name: "asc" }], select: { id: true, name: true, isSystem: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Users Management"
        subtitle="All accounts across the program · staff, parents & students"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchBar placeholder="Search name or email" />
            {perms.create && <UserModal institutions={institutions} managers={managers} appRoles={appRoles} />}
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
                <div className="flex items-center gap-1">
                  {perms.edit && (
                    <>
                      <UserModal user={u} institutions={institutions} managers={managers} appRoles={appRoles} />
                      <ActionForm action={setUserStatus} className="inline-flex">
                        <input type="hidden" name="id" value={u.id} />
                        <input type="hidden" name="status" value={u.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"} />
                        <SubmitButton
                          className={u.status === "ACTIVE" ? "btn-ghost text-xs text-red-600" : "btn-ghost text-xs text-leaf-700"}
                          pendingText="…"
                        >
                          <Power className="h-3.5 w-3.5" />
                          {u.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </SubmitButton>
                      </ActionForm>
                    </>
                  )}
                  {perms.delete && (
                    <ConfirmDeleteButton
                      action={deleteUser}
                      hiddenFields={{ id: u.id }}
                      itemLabel={u.name}
                      warning="Deletion is blocked if this account has session or message history — deactivate instead in that case. Otherwise this is permanent."
                      successMessage="User deleted."
                      triggerClassName="btn-ghost text-xs text-red-600"
                    />
                  )}
                  {!perms.edit && !perms.delete && <span className="text-xs text-slate-300">—</span>}
                </div>
              ),
            },
          ]}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/users" searchParams={{ q, tab }} />
      </Panel>
    </>
  );
}

function UserModal({
  user,
  institutions,
  managers,
  appRoles,
}: {
  user?: User;
  institutions: { id: string; name: string }[];
  managers: { id: string; name: string; role: Role }[];
  appRoles: { id: string; name: string; isSystem: boolean }[];
}) {
  return (
    <Modal
      title={user ? "Edit User" : "Add User"}
      triggerClassName={user ? "btn-ghost text-xs" : "btn-primary"}
      triggerLabel={user ? <><Pencil className="h-3.5 w-3.5" /> Edit</> : <><UserPlus className="h-4 w-4" /> Add User</>}
    >
      <ActionForm action={saveUser} className="space-y-4" successMessage={user ? "User updated." : "User created."}>
          {user && <input type="hidden" name="id" value={user.id} />}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input name="name" className="input" required defaultValue={user?.name ?? ""} placeholder="Jane Doe" />
            </Field>
            <Field label="Email">
              <input name="email" type="email" className="input" required defaultValue={user?.email ?? ""} placeholder="jane@ndhrglobal.com" />
            </Field>
            <Field label="Role">
              <select name="role" className="input" required defaultValue={user?.role ?? "MENTOR"}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {titleCase(r)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Title / Designation">
              <input name="title" className="input" defaultValue={user?.title ?? ""} placeholder="Mentor" />
            </Field>
            <Field label="Phone">
              <input name="phone" className="input" defaultValue={user?.phone ?? ""} placeholder="+91 98470 00000" />
            </Field>
            {!user && (
              <Field label="Temporary password" hint="Defaults to Elevate@123 if left blank.">
                <input name="password" className="input" placeholder="Elevate@123" />
              </Field>
            )}
            <Field label="Institution">
              <select name="institutionId" className="input" defaultValue={user?.institutionId ?? ""}>
                <option value="">— None —</option>
                {institutions.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Reports to (Manager)">
              <select name="managerId" className="input" defaultValue={user?.managerId ?? ""}>
                <option value="">— None —</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} · {titleCase(m.role)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Permission role" hint="Controls what this user can create/view/edit/delete. Default = their workspace role's standard permissions.">
              <select name="appRoleId" className="input" defaultValue={user?.appRoleId ?? ""}>
                <option value="">— Default for workspace role —</option>
                {appRoles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}{r.isSystem ? " (system)" : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <h4 className="mt-2 border-b border-slate-100 pb-1 text-sm font-bold text-navy">Mentor profile (for mentors)</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Mentoring mode">
              <select name="mentoringMode" className="input" defaultValue={user?.mentoringMode ?? ""}>
                <option value="">— N/A —</option>
                <option value="ONLINE">Online</option>
                <option value="OFFLINE">Offline</option>
                <option value="BOTH">Both</option>
              </select>
            </Field>
            <Field label="City">
              <input name="city" className="input" defaultValue={user?.city ?? ""} placeholder="Kochi" />
            </Field>
            <Field label="Languages">
              <input name="languages" className="input" defaultValue={user?.languages ?? ""} placeholder="English, Malayalam" />
            </Field>
            <Field label="Time zone">
              <input name="timezone" className="input" defaultValue={user?.timezone ?? ""} placeholder="GMT+5:30" />
            </Field>
            <Field label="Exposure">
              <input name="exposure" className="input" defaultValue={user?.exposure ?? ""} placeholder="International / European exposure" />
            </Field>
            <Field label="Years of experience">
              <input name="yearsExperience" type="number" min={0} className="input" defaultValue={user?.yearsExperience ?? ""} placeholder="5" />
            </Field>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <SubmitButton>{user ? "Save changes" : "Create user"}</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}
