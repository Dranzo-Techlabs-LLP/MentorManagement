import { Megaphone, Plus, Pin } from "lucide-react";
import type { Audience } from "@prisma/client";
import { prisma } from "@/lib/db";
import { createAnnouncement } from "@/lib/actions";
import { PageHeader, Badge, EmptyState } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton, Field } from "@/components/ui/form";
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

export default async function AnnouncementsPage() {
  const announcements = await prisma.announcement.findMany({
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    include: { author: true },
  });

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
              </div>
              <p className="mt-3 whitespace-pre-line text-sm text-slate-600">{a.body}</p>
            </div>
          ))}
        </div>
      )}
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
