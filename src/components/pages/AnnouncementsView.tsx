import { redirect } from "next/navigation";
import { Megaphone, Plus, Pin, Pencil } from "lucide-react";
import type { Announcement, Audience, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPerms } from "@/lib/permissions";
import { ROLE_HOME } from "@/lib/rbac";
import { createAnnouncement, updateAnnouncement, deleteAnnouncement } from "@/lib/actions";
import { PageHeader, Badge, EmptyState } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { SubmitButton, Field } from "@/components/ui/form";
import { Pagination } from "@/components/ui/Pagination";
import { fmtDateTime, titleCase } from "@/lib/utils";

const AUDIENCES: Audience[] = [
  "ALL", "MENTORS", "SUPERVISORS", "CHIEF_MENTORS", "PARENTS", "STUDENTS", "INSTITUTION",
];
const PAGE_SIZE = 10;

/** The audience bucket a given workspace role belongs to. */
const AUDIENCE_FOR_ROLE: Partial<Record<Role, Audience>> = {
  CHIEF_MENTOR: "CHIEF_MENTORS",
  SUPERVISOR: "SUPERVISORS",
  MENTOR: "MENTORS",
  PARENT: "PARENTS",
  STUDENT: "STUDENTS",
};

/**
 * Announcements — shared by every workspace that can be granted the
 * `announcements` resource.
 *
 * Readers (no create/edit/delete rights) only see broadcasts addressed to
 * them: audience ALL plus their own role's bucket. Anyone who can manage
 * announcements sees the full list, since they need to review what they
 * publish. Every control is gated on the permission matrix, never on role.
 */
export async function AnnouncementsView({ basePath, page }: { basePath: string; page: number }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const perms = await getPerms("announcements");
  if (!perms.view) redirect(ROLE_HOME[session.role]);

  const canManage = perms.create || perms.edit || perms.delete;
  const own = AUDIENCE_FOR_ROLE[session.role];
  const where: Prisma.AnnouncementWhereInput =
    canManage || !own ? {} : { OR: [{ audience: "ALL" }, { audience: own }] };

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { author: true },
    }),
    prisma.announcement.count({ where }),
  ]);

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="Program-wide broadcasts and notices"
        action={perms.create ? <NewAnnouncementModal /> : undefined}
      />

      {announcements.length === 0 ? (
        <Panel>
          <EmptyState
            title="No announcements yet"
            hint={
              perms.create
                ? "Create your first announcement to broadcast to the program."
                : "Announcements addressed to you will appear here."
            }
            icon={<Megaphone className="h-8 w-8" />}
          />
        </Panel>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <div key={a.id} className={`card p-5 ${a.pinned ? "border-l-4 border-l-gold" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-navy-50 text-navy">
                    <Megaphone className="h-5 w-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-bold text-navy">{a.title}</h3>
                      {a.pinned && (
                        <Badge tone="gold">
                          <Pin className="mr-1 inline h-3 w-3" /> Pinned
                        </Badge>
                      )}
                      <Badge tone="blue">{titleCase(a.audience)}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {a.author?.name ?? "System"} · {fmtDateTime(a.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {perms.edit && <EditAnnouncementModal announcement={a} />}
                  {perms.delete && (
                    <ConfirmDeleteButton
                      action={deleteAnnouncement}
                      hiddenFields={{ id: a.id }}
                      itemLabel={a.title}
                      successMessage="Announcement deleted."
                      triggerClassName="btn-ghost text-xs text-red-600"
                    />
                  )}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{a.body}</p>
            </div>
          ))}
        </div>
      )}

      <Panel className="mt-4">
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath={basePath} searchParams={{}} />
      </Panel>
    </>
  );
}

function NewAnnouncementModal() {
  return (
    <Modal
      title="New Announcement"
      triggerClassName="btn-primary"
      triggerLabel={<><Plus className="h-4 w-4" /> New Announcement</>}
    >
      <ActionForm action={createAnnouncement} className="space-y-4" successMessage="Announcement published.">
        <Field label="Title">
          <input name="title" className="input" required placeholder="e.g. Annual Leadership Camp" />
        </Field>
        <Field label="Message">
          <textarea name="body" className="input" rows={5} required placeholder="Write the announcement…" />
        </Field>
        <Field label="Audience">
          <select name="audience" className="input" defaultValue="ALL">
            {AUDIENCES.map((a) => (
              <option key={a} value={a}>{titleCase(a)}</option>
            ))}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <input type="checkbox" name="pinned" className="h-4 w-4 rounded border-slate-300" />
          Pin to top
        </label>
        <div className="flex justify-end">
          <SubmitButton>Publish announcement</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}

function EditAnnouncementModal({ announcement }: { announcement: Announcement }) {
  return (
    <Modal
      title="Edit Announcement"
      triggerClassName="btn-ghost text-xs"
      triggerLabel={<><Pencil className="h-3.5 w-3.5" /> Edit</>}
    >
      <ActionForm action={updateAnnouncement} className="space-y-4" successMessage="Announcement updated.">
        <input type="hidden" name="id" value={announcement.id} />
        <Field label="Title">
          <input name="title" className="input" required defaultValue={announcement.title} />
        </Field>
        <Field label="Message">
          <textarea name="body" className="input" rows={5} required defaultValue={announcement.body} />
        </Field>
        <Field label="Audience">
          <select name="audience" className="input" defaultValue={announcement.audience}>
            {AUDIENCES.map((a) => <option key={a} value={a}>{titleCase(a)}</option>)}
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <input type="checkbox" name="pinned" className="h-4 w-4 rounded border-slate-300" defaultChecked={announcement.pinned} />
          Pin to top
        </label>
        <div className="flex justify-end">
          <SubmitButton>Save changes</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}
