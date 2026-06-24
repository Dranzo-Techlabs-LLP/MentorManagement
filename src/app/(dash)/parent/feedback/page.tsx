import { redirect } from "next/navigation";
import { MessageCircle, Star } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { submitFeedback } from "@/lib/actions";
import { PageHeader, EmptyState } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton, Field } from "@/components/ui/form";
import { fmtDate } from "@/lib/utils";

export default async function ParentFeedbackPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const children = await prisma.student.findMany({
    where: { parentId: session.userId },
    orderBy: { fullName: "asc" },
    include: { mentor: true },
  });

  const pastFeedback = await prisma.feedback.findMany({
    where: { fromUserId: session.userId },
    orderBy: { createdAt: "desc" },
    include: { mentor: true, student: true },
  });

  // Unique mentors across the parent's children.
  const mentors = Array.from(
    new Map(
      children
        .filter((c) => c.mentor)
        .map((c) => [c.mentor!.id, c.mentor!]),
    ).values(),
  );

  return (
    <>
      <PageHeader title="Give Feedback" subtitle="Share your experience with your child's mentor" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="New Feedback">
          {children.length === 0 ? (
            <EmptyState title="No children linked" hint="You can give feedback once a child is enrolled." icon={<MessageCircle className="h-8 w-8" />} />
          ) : (
            <ActionForm action={submitFeedback} resetOnSuccess className="space-y-4">
              <Field label="About child">
                <select name="studentId" className="input" defaultValue="">
                  <option value="">— General —</option>
                  {children.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Mentor">
                <select name="mentorId" className="input" defaultValue="">
                  <option value="">— Select mentor —</option>
                  {mentors.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Rating">
                <select name="rating" className="input" defaultValue="5">
                  {[5, 4, 3, 2, 1].map((r) => (
                    <option key={r} value={r}>
                      {r} · {["", "Poor", "Fair", "Good", "Very good", "Excellent"][r]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Your comments">
                <textarea name="comment" className="input" rows={4} required placeholder="Tell us about your experience…" />
              </Field>
              <div className="flex justify-end">
                <SubmitButton pendingText="Submitting…">Submit feedback</SubmitButton>
              </div>
            </ActionForm>
          )}
        </Panel>

        <Panel title="My Previous Feedback">
          {pastFeedback.length === 0 ? (
            <EmptyState title="No feedback yet" hint="Your submitted feedback will appear here." icon={<MessageCircle className="h-8 w-8" />} />
          ) : (
            <div className="space-y-3">
              {pastFeedback.map((f) => (
                <div key={f.id} className="rounded-xl border border-slate-100 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          className="h-4 w-4"
                          style={{ color: i < (f.rating ?? 0) ? "#E0A92E" : "#e2e8f0" }}
                          fill={i < (f.rating ?? 0) ? "#E0A92E" : "#e2e8f0"}
                        />
                      ))}
                    </div>
                    <StatusBadge status={f.status} />
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{f.comment}</p>
                  <p className="mt-1.5 text-xs text-slate-400">
                    {f.mentor ? `For ${f.mentor.name}` : "General"}
                    {f.student ? ` · ${f.student.fullName}` : ""} · {fmtDate(f.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
