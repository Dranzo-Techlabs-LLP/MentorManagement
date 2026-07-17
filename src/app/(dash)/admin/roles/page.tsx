import { redirect } from "next/navigation";
import { Plus, Pencil, Shield, Lock, Users } from "lucide-react";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { ensureRbacSeeded } from "@/lib/permissions";
import { RESOURCES, OPS, DEFAULT_MATRIX, type Op } from "@/lib/permission-data";
import { saveAppRole, deleteAppRole, saveRolePermissions } from "@/lib/actions";
import { PageHeader, Badge } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { SubmitButton, Field } from "@/components/ui/form";
import { titleCase } from "@/lib/utils";

const BASE_ROLES: Role[] = ["SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR", "MENTOR", "PARENT", "STUDENT"];
const OP_LABEL: Record<Op, string> = { create: "Create", view: "View", edit: "Edit", delete: "Delete" };

export default async function RolesPage() {
  const session = await getSession();
  if (!session || session.role !== "SUPER_ADMIN") redirect("/login");

  await ensureRbacSeeded();

  const roles = await prisma.appRole.findMany({
    orderBy: [{ isSystem: "desc" }, { createdAt: "asc" }],
    include: { permissions: true, _count: { select: { users: true } } },
  });

  return (
    <>
      <PageHeader
        title="Roles & Responsibilities"
        subtitle="Control what each role can create, view, edit and delete across every module"
        action={<CreateRoleModal />}
      />

      <div className="space-y-4">
        {roles.map((role) => {
          const locked = role.isSystem && role.baseRole === "SUPER_ADMIN";
          const rows = new Map(role.permissions.map((p) => [p.resource, p]));
          return (
            <details key={role.id} className="card overflow-hidden" open={locked === false && role.isSystem === false}>
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-slate-50/60">
                <span className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${locked ? "bg-amber-50 text-amber-600" : "bg-navy-50 text-navy"}`}>
                    {locked ? <Lock className="h-4 w-4" /> : <Shield className="h-4 w-4" />}
                  </span>
                  <span>
                    <span className="font-bold text-navy">{role.name}</span>
                    <span className="ml-2 align-middle">
                      {role.isSystem ? <Badge tone="slate">System</Badge> : <Badge tone="teal">Custom</Badge>}
                      <Badge tone="blue" className="ml-1.5">
                        <Users className="mr-1 inline h-3 w-3" />
                        {role._count.users} user{role._count.users === 1 ? "" : "s"}
                      </Badge>
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-400">
                      Workspace: {titleCase(role.baseRole)}
                      {locked && " · Full access — locked to prevent lockout"}
                    </span>
                  </span>
                </span>
                {!role.isSystem && (
                  <span className="flex items-center gap-1">
                    <EditRoleModal role={role} />
                    <ConfirmDeleteButton
                      action={deleteAppRole}
                      hiddenFields={{ id: role.id }}
                      itemLabel={`the "${role.name}" role`}
                      warning={
                        role._count.users > 0
                          ? `${role._count.users} user(s) currently hold this role — they will fall back to their workspace's default permissions.`
                          : "This is permanent and cannot be undone."
                      }
                      triggerClassName="btn-ghost text-xs text-red-600"
                    />
                  </span>
                )}
              </summary>

              <div className="border-t border-slate-100 p-5">
                <ActionForm action={saveRolePermissions} className="space-y-4" successMessage="Permissions saved.">
                  <input type="hidden" name="roleId" value={role.id} />
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50/60">
                          <th className="table-th">Module / Section</th>
                          {OPS.map((op) => (
                            <th key={op} className="table-th text-center">{OP_LABEL[op]}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {RESOURCES.map((r) => {
                          const row = rows.get(r.key);
                          const fallback = DEFAULT_MATRIX[role.baseRole][r.key];
                          const val = (op: Op) =>
                            locked ? true : row ? { create: row.canCreate, view: row.canView, edit: row.canEdit, delete: row.canDelete }[op] : fallback[op];
                          return (
                            <tr key={r.key} className="hover:bg-slate-50/60">
                              <td className="table-td font-medium">{r.label}</td>
                              {OPS.map((op) => (
                                <td key={op} className="table-td text-center">
                                  <input
                                    type="checkbox"
                                    name={`${r.key}.${op}`}
                                    defaultChecked={val(op)}
                                    disabled={locked}
                                    className="h-4 w-4 rounded border-slate-300 text-navy focus:ring-navy disabled:opacity-50"
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {!locked && (
                    <div className="flex justify-end">
                      <SubmitButton>Save permissions</SubmitButton>
                    </div>
                  )}
                  {locked && (
                    <p className="text-xs text-slate-400">
                      Super Admin always has every permission. This cannot be edited or revoked.
                    </p>
                  )}
                </ActionForm>
              </div>
            </details>
          );
        })}
      </div>
    </>
  );
}

function EditRoleModal({ role }: { role: { id: string; name: string; baseRole: Role } }) {
  return (
    <Modal
      title="Edit Role"
      triggerClassName="btn-ghost text-xs"
      triggerLabel={<><Pencil className="h-3.5 w-3.5" /> Edit</>}
    >
      <ActionForm action={saveAppRole} className="space-y-4" successMessage="Role updated.">
        <input type="hidden" name="id" value={role.id} />
        <Field label="Role name">
          <input name="name" className="input" required defaultValue={role.name} />
        </Field>
        <Field label="Workspace (base role)" hint="Which dashboard & pages this role's users see.">
          <select name="baseRole" className="input" defaultValue={role.baseRole}>
            {BASE_ROLES.map((r) => (
              <option key={r} value={r}>{titleCase(r)}</option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Save changes</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}

function CreateRoleModal() {
  return (
    <Modal
      title="Create Role"
      triggerClassName="btn-primary"
      triggerLabel={<><Plus className="h-4 w-4" /> Create Role</>}
    >
      <ActionForm action={saveAppRole} className="space-y-4" successMessage="Role created — configure its permissions below.">
        <Field label="Role name">
          <input name="name" className="input" required placeholder="e.g. Program Coordinator" />
        </Field>
        <Field
          label="Workspace (base role)"
          hint="Decides which dashboard & pages the role's users see. Permissions start from this role's defaults and can then be customised."
        >
          <select name="baseRole" className="input" defaultValue="SUPERVISOR">
            {BASE_ROLES.map((r) => (
              <option key={r} value={r}>{titleCase(r)}</option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Create role</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}
