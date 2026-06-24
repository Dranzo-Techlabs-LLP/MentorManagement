import { Building2, Plus, Pencil } from "lucide-react";
import type { Institution, InstitutionType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { saveInstitution } from "@/lib/actions";
import { PageHeader, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton, Field } from "@/components/ui/form";
import { titleCase } from "@/lib/utils";

const TYPES: InstitutionType[] = ["SCHOOL", "MAHALL", "COLLEGE", "NDHR_CLIENT", "OTHER"];

export default async function InstitutionsPage() {
  const institutions = await prisma.institution.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { students: true, users: true } } },
  });

  return (
    <>
      <PageHeader
        title="Institutions"
        subtitle="Partner schools, mahalls, colleges & client organisations"
        action={
          <Modal
            title="Add Institution"
            triggerClassName="btn-primary"
            triggerLabel={<><Plus className="h-4 w-4" /> Add Institution</>}
          >
            <InstitutionForm />
          </Modal>
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
                <Modal
                  title="Edit Institution"
                  triggerClassName="btn-ghost text-xs"
                  triggerLabel={<><Pencil className="h-3.5 w-3.5" /> Edit</>}
                >
                  <InstitutionForm institution={i} />
                </Modal>
              ),
            },
          ]}
        />
      </Panel>
    </>
  );
}

function InstitutionForm({ institution }: { institution?: Institution }) {
  return (
    <ActionForm action={saveInstitution} className="space-y-4">
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
