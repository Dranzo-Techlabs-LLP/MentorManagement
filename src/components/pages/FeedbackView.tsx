import { redirect } from "next/navigation";
import { Star, CheckCircle2, MessageCircle } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { getPerms } from "@/lib/permissions";
import { ROLE_HOME } from "@/lib/rbac";
import { markFeedbackReviewed, deleteFeedback } from "@/lib/actions";
import { PageHeader, Avatar, EmptyState } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { SubmitButton } from "@/components/ui/form";
import { Pagination } from "@/components/ui/Pagination";
import { timeAgo } from "@/lib/utils";

const PAGE_SIZE = 10;

/**
 * Feedback — shared by every workspace that can be granted the `feedback`
 * resource. Permission decides the controls; the viewer's role decides how
 * much of the data they are scoped to:
 *   Super Admin / Chief Mentor  → program-wide
 *   Supervisor                  → feedback about the mentors they manage
 *   Mentor                      → feedback about themselves
 * Anything else sees only feedback they submitted, so a granted `view` can
 * never widen someone's data window beyond their own place in the hierarchy.
 */
async function scopeFor(userId: string, role: string): Promise<Prisma.FeedbackWhereInput> {
  if (role === "SUPER_ADMIN" || role === "CHIEF_MENTOR") return {};
  if (role === "SUPERVISOR") {
    const mentorIds = (
      await prisma.user.findMany({ where: { managerId: userId, role: "MENTOR" }, select: { id: true } })
    ).map((m) => m.id);
    return { mentorId: { in: mentorIds.length ? mentorIds : ["__none__"] } };
  }
  if (role === "MENTOR") return { mentorId: userId };
  return { fromUserId: userId };
}

export async function FeedbackView({ basePath, page }: { basePath: string; page: number }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const perms = await getPerms("feedback");
  if (!perms.view) redirect(ROLE_HOME[session.role]);

  const where = await scopeFor(session.userId, session.role);
  const [feedback, total] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { fromUser: true, student: true, mentor: true },
    }),
    prisma.feedback.count({ where }),
  ]);

  return (
    <>
      <PageHeader title="Feedback" subtitle="Parent & student feedback on mentoring" />

      {feedback.length === 0 ? (
        <Panel>
          <EmptyState
            title="No feedback yet"
            hint="Feedback submitted about mentoring will appear here."
            icon={<MessageCircle className="h-8 w-8" />}
          />
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {feedback.map((f) => (
            <div key={f.id} className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Avatar name={f.fromUser?.name ?? "Anonymous"} src={f.fromUser?.avatar} size={36} />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-700">{f.fromUser?.name ?? "Anonymous"}</p>
                    <p className="truncate text-xs text-slate-400">
                      For {f.mentor?.name ?? "—"}
                      {f.student ? ` · re ${f.student.fullName}` : ""}
                    </p>
                  </div>
                </div>
                <StatusBadge status={f.status} />
              </div>

              {f.rating != null && (
                <div className="mt-3 flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`h-4 w-4 ${i < f.rating! ? "fill-gold text-gold" : "text-slate-200"}`} />
                  ))}
                </div>
              )}

              <p className="mt-2 text-sm text-slate-600">{f.comment}</p>

              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-slate-400">{timeAgo(f.createdAt)}</span>
                <div className="flex items-center gap-1.5">
                  {f.status === "NEW" && perms.edit && (
                    <ActionForm action={markFeedbackReviewed} className="inline-flex" successMessage="Feedback marked reviewed.">
                      <input type="hidden" name="id" value={f.id} />
                      <SubmitButton className="btn-green text-xs" pendingText="…">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Mark Reviewed
                      </SubmitButton>
                    </ActionForm>
                  )}
                  {perms.delete && (
                    <ConfirmDeleteButton
                      action={deleteFeedback}
                      hiddenFields={{ id: f.id }}
                      itemLabel="this feedback"
                      successMessage="Feedback deleted."
                      triggerClassName="btn-ghost text-xs text-red-600"
                    />
                  )}
                </div>
              </div>
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
