import { Megaphone, Plus, Pin, Pencil } from "lucide-react";
import type { Announcement, Audience } from "@prisma/client";
import { prisma } from "@/lib/db";
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
  "ALL",
  "MENTORS",
  "SUPERVISORS",
  "CHIEF_MENTORS",
  "PARENTS",
  "STUDENTS",
  "INSTITUTION",
];
const PAGE_SIZE = 10;

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE,
      include: { author: true },
    }),
    prisma.announcement.count(),
  ]);

  return (
    <>
      <PageHeader
        title="Announcements"
        subtitle="Program-wide broadcasts and notices"
        action={<NewAnnouncementModal />}
      />

      {announcements.length === 0 ? (
        <Panel>
          <EmptyState title="No announcements yet" hint="Create your first announcement to broadcast to the program." icon={<Megaphone className="h-8 w-8" />} />
        </Panel>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <div
              key={a.id}
              className={`card p-5 ${a.pinned ? "border-l-4 border-l-gold" : ""}`}
            >
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
                  <EditAnnouncementModal announcement={a} />
                  <ConfirmDeleteButton
                    action={deleteAnnouncement}
                    hiddenFields={{ id: a.id }}
                    itemLabel={a.title}
                    triggerClassName="btn-ghost text-xs text-red-600"
                  />
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{a.body}</p>
            </div>
          ))}
        </div>
      )}
      <Panel className="mt-4">
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/announcements" searchParams={{}} />
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
      <ActionForm action={createAnnouncement} className="space-y-4">
          <Field label="Title">
            <input name="title" className="input" required placeholder="e.g. Annual Leadership Camp" />
          </Field>
          <Field label="Message">
            <textarea name="body" className="input" rows={5} required placeholder="Write the announcement…" />
          </Field>
          <Field label="Audience">
            <select name="audience" className="input" defaultValue="ALL">
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {titleCase(a)}
                </option>
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
