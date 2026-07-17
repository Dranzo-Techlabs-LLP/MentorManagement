import Link from "next/link";
import { UserPlus, Pencil } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
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
import { Pagination } from "@/components/ui/Pagination";

const PAGE_SIZE = 10;

export default async function ParentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const perms = await getPerms("parents");

  const where: Prisma.UserWhereInput = {
    role: "PARENT",
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
  };

  const [parents, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        studentsAsParent: { select: { id: true, fullName: true } },
      },
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
            {
              header: "Children",
              cell: (p) => <Badge tone="blue">{p.studentsAsParent.length}</Badge>,
            },
            {
              header: "Children Names",
              cell: (p) =>
                p.studentsAsParent.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {p.studentsAsParent.map((s) => (
                      <Link
                        key={s.id}
                        href={`/admin/students/${s.id}`}
                        className="rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-navy hover:bg-navy-50"
                      >
                        {s.fullName}
                      </Link>
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
                      triggerClassName="btn-ghost text-xs text-red-600"
                    />
                  )}
                  {!perms.edit && !perms.delete && <span className="text-xs text-slate-300">—</span>}
                </div>
              ),
            },
          ]}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/parents" searchParams={{ q }} />
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
