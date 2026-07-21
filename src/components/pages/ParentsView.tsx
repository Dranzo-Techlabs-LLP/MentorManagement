import Link from "next/link";
import { redirect } from "next/navigation";
import { UserPlus, Pencil } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPerms } from "@/lib/permissions";
import { ROLE_HOME } from "@/lib/rbac";
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
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 10;

/**
 * Parents — shared by every workspace that can be granted the `parents`
 * resource. Permission decides the controls; role decides the data window:
 *   Super Admin / Chief Mentor → every guardian account
 *   Supervisor                 → guardians of students their mentor team holds
 *   Mentor                     → guardians of their own mentees
 *   anyone else                → only their own account
 * so granting `view` never widens someone's window past their own scope.
 */
async function parentIdsForStudentsOf(mentorIds: string[]): Promise<Prisma.UserWhereInput> {
  const parentIds = mentorIds.length
    ? (
        await prisma.student.findMany({
          where: { mentorId: { in: mentorIds }, parentId: { not: null } },
          select: { parentId: true },
        })
      ).map((s) => s.parentId as string)
    : [];
  return { id: { in: parentIds.length ? parentIds : ["__none__"] } };
}

async function scopeFor(userId: string, role: string): Promise<Prisma.UserWhereInput> {
  if (role === "SUPER_ADMIN" || role === "CHIEF_MENTOR") return {};
  if (role === "SUPERVISOR") {
    const mentorIds = (
      await prisma.user.findMany({ where: { managerId: userId, role: "MENTOR" }, select: { id: true } })
    ).map((m) => m.id);
    return parentIdsForStudentsOf(mentorIds);
  }
  if (role === "MENTOR") return parentIdsForStudentsOf([userId]);
  return { id: userId };
}

export async function ParentsView({
  basePath,
  page,
  q,
}: {
  basePath: string;
  page: number;
  q?: string;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const perms = await getPerms("parents");
  if (!perms.view) redirect(ROLE_HOME[session.role]);

  const scope = await scopeFor(session.userId, session.role);
  const where: Prisma.UserWhereInput = {
    role: "PARENT",
    ...scope,
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
  };

  const [parents, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { studentsAsParent: { select: { id: true, fullName: true } } },
    }),
    prisma.user.count({ where }),
  ]);

  return (
    <>
      <PageHeader
        title="Parents"
        subtitle="Guardian accounts and their enrolled children"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchBar placeholder="Search parents" />
            {perms.create && <ParentModal />}
          </div>
        }
      />

      <Panel>
        <DataTable
          rows={parents}
          getKey={(p) => p.id}
          empty="No parents found."
          columns={[
            {
              header: "Parent",
              cell: (p) => (
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} src={p.avatar} size={36} tint="#6d28d9" />
                  <p className="font-semibold text-slate-700">{p.name}</p>
                </div>
              ),
            },
            { header: "Email", cell: (p) => <span className="text-slate-600">{p.email}</span> },
            { header: "Phone", cell: (p) => <span className="text-slate-600">{p.phone ?? "—"}</span> },
            { header: "Children", cell: (p) => <Badge tone="blue">{p.studentsAsParent.length}</Badge> },
            {
              header: "Children Names",
              cell: (p) =>
                p.studentsAsParent.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {p.studentsAsParent.map((s) => (
                      <span
                        key={s.id}
                        className="rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-navy"
                      >
                        {s.fullName}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400">—</span>
                ),
            },
            { header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
            {
              header: "Actions",
              cell: (p) => (
                <div className="flex items-center gap-1">
                  {perms.edit && <ParentModal parent={p} />}
                  {perms.delete && (
                    <ConfirmDeleteButton
                      action={deleteUser}
                      hiddenFields={{ id: p.id }}
                      itemLabel={p.name}
                      warning={
                        p.studentsAsParent.length > 0
                          ? `${p.studentsAsParent.length} enrolled child(ren) are linked to this account — they will lose the parent link but stay enrolled. This is permanent.`
                          : "This is permanent and cannot be undone."
                      }
                      successMessage="Parent deleted."
                      triggerClassName="btn-ghost text-xs text-red-600"
                    />
                  )}
                  {!perms.edit && !perms.delete && <span className="text-xs text-slate-300">—</span>}
                </div>
              ),
            },
          ]}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath={basePath} searchParams={{ q }} />
      </Panel>
    </>
  );
}

function ParentModal({
  parent,
}: {
  parent?: { id: string; name: string; email: string; phone: string | null };
}) {
  return (
    <Modal
      title={parent ? "Edit Parent" : "Add Parent"}
      triggerClassName={parent ? "btn-ghost text-xs" : "btn-primary"}
      triggerLabel={parent ? <><Pencil className="h-3.5 w-3.5" /> Edit</> : <><UserPlus className="h-4 w-4" /> Add Parent</>}
    >
      <ActionForm action={saveUser} className="space-y-4" successMessage={parent ? "Parent updated." : "Parent created."}>
        {parent && <input type="hidden" name="id" value={parent.id} />}
        <input type="hidden" name="role" value="PARENT" />
        <Field label="Full name">
          <input name="name" className="input" required defaultValue={parent?.name ?? ""} placeholder="Guardian name" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" className="input" required defaultValue={parent?.email ?? ""} placeholder="parent@example.com" />
        </Field>
        <Field label="Phone">
          <input name="phone" className="input" defaultValue={parent?.phone ?? ""} placeholder="+91 98470 00000" />
        </Field>
        {!parent && (
          <Field label="Temporary password" hint="Defaults to Elevate@123 if left blank.">
            <input name="password" className="input" placeholder="Elevate@123" />
          </Field>
        )}
        <div className="flex justify-end pt-2">
          <SubmitButton>{parent ? "Save changes" : "Create parent"}</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}
