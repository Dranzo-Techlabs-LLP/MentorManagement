import { redirect } from "next/navigation";
import { Building2, Plus, Pencil } from "lucide-react";
import type { Institution, InstitutionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPerms } from "@/lib/permissions";
import { ROLE_HOME } from "@/lib/rbac";
import { saveInstitution, deleteInstitution } from "@/lib/actions";
import { PageHeader, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { SubmitButton, Field } from "@/components/ui/form";
import { Pagination } from "@/components/ui/Pagination";
import { titleCase } from "@/lib/utils";

const TYPES: InstitutionType[] = ["SCHOOL", "MAHALL", "COLLEGE", "NDHR_CLIENT", "OTHER"];
const PAGE_SIZE = 10;

/**
 * Institutions list — shared by every workspace that can be granted the
 * `institutions` resource (admin, chief, supervisor, …).
 *
 * Institutions are global reference data with no per-user scoping, so one
 * component serves all roles: visibility and every CRUD control is decided
 * purely by the permission matrix, never by the caller's role. `basePath`
 * only exists so pagination links stay inside the caller's namespace.
 */
export async function InstitutionsView({ basePath, page }: { basePath: string; page: number }) {
  const session = await getSession();
  if (!session) redirect("/login");

  // Reaching this route without `view` (e.g. a hand-typed URL after the
  // permission was revoked) bounces back to the role's own home.
  const perms = await getPerms("institutions");
  if (!perms.view) redirect(ROLE_HOME[session.role]);

  const [institutions, total] = await Promise.all([
    prisma.institution.findMany({
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { students: true, users: true } } },
    }),
    prisma.institution.count(),
  ]);

  return (
    <>
      <PageHeader
        title="Institutions"
        subtitle="Partner schools, mahalls, colleges & client organisations"
        action={
          perms.create ? (
            <Modal
              title="Add Institution"
              triggerClassName="btn-primary"
              triggerLabel={<><Plus className="h-4 w-4" /> Add Institution</>}
            >
              <InstitutionForm />
            </Modal>
          ) : undefined
        }
      />

      <Panel>
        <DataTable
          rows={institutions}
          getKey={(i) => i.id}
          empty="No institutions yet."
          columns={[
            {
              header: "Institution",
              cell: (i) => (
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-navy-50 text-navy">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-700">{i.name}</p>
                    {i.code && <p className="text-xs text-slate-400">{i.code}</p>}
                  </div>
                </div>
              ),
            },
            { header: "Type", cell: (i) => <Badge tone="teal">{titleCase(i.type)}</Badge> },
            { header: "City", cell: (i) => <span className="text-slate-600">{i.city ?? "—"}</span> },
            { header: "Contact", cell: (i) => <span className="text-slate-600">{i.contactName ?? "—"}</span> },
            { header: "Students", cell: (i) => <span className="font-medium text-slate-600">{i._count.students}</span> },
            { header: "Users", cell: (i) => <span className="font-medium text-slate-600">{i._count.users}</span> },
            {
              header: "Actions",
              cell: (i) => (
                <div className="flex items-center gap-1">
                  {perms.edit && (
                    <Modal
                      title="Edit Institution"
                      triggerClassName="btn-ghost text-xs"
                      triggerLabel={<><Pencil className="h-3.5 w-3.5" /> Edit</>}
                    >
                      <InstitutionForm institution={i} />
                    </Modal>
                  )}
                  {perms.delete && (
                    <ConfirmDeleteButton
                      action={deleteInstitution}
                      hiddenFields={{ id: i.id }}
                      itemLabel={i.name}
                      warning={
                        i._count.students + i._count.users > 0
                          ? `${i._count.students} student(s) and ${i._count.users} staff account(s) are linked to this institution — they will just lose this affiliation, not be deleted. This is permanent.`
                          : "This is permanent and cannot be undone."
                      }
                      successMessage="Institution deleted."
                      triggerClassName="btn-ghost text-xs text-red-600"
                    />
                  )}
                  {!perms.edit && !perms.delete && <span className="text-xs text-slate-300">—</span>}
                </div>
              ),
            },
          ]}
        />
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath={basePath} searchParams={{}} />
      </Panel>
    </>
  );
}

function InstitutionForm({ institution }: { institution?: Institution }) {
  return (
    <ActionForm
      action={saveInstitution}
      className="space-y-4"
      successMessage={institution ? "Institution updated." : "Institution created."}
    >
      {institution && <input type="hidden" name="id" value={institution.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name">
          <input name="name" className="input" required defaultValue={institution?.name ?? ""} placeholder="Greenwood Public School" />
        </Field>
        <Field label="Type">
          <select name="type" className="input" defaultValue={institution?.type ?? "SCHOOL"}>
            {TYPES.map((t) => (
              <option key={t} value={t}>
                {titleCase(t)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="City">
          <input name="city" className="input" defaultValue={institution?.city ?? ""} placeholder="Kochi" />
        </Field>
        <Field label="Address">
          <input name="address" className="input" defaultValue={institution?.address ?? ""} placeholder="Street, area" />
        </Field>
        <Field label="Contact name">
          <input name="contactName" className="input" defaultValue={institution?.contactName ?? ""} placeholder="Principal name" />
        </Field>
        <Field label="Contact phone">
          <input name="contactPhone" className="input" defaultValue={institution?.contactPhone ?? ""} placeholder="+91 …" />
        </Field>
        <Field label="Contact email">
          <input name="contactEmail" type="email" className="input" defaultValue={institution?.contactEmail ?? ""} placeholder="office@school.edu" />
        </Field>
      </div>
      <div className="flex justify-end pt-2">
        <SubmitButton>{institution ? "Save changes" : "Create institution"}</SubmitButton>
      </div>
    </ActionForm>
  );
}
