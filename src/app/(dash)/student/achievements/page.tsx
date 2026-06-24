import { redirect } from "next/navigation";
import { Trophy } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, EmptyState, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { fmtDate } from "@/lib/utils";

export default async function StudentAchievementsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const student = await prisma.student.findFirst({
    where: { userId: session.userId },
    include: { achievements: { orderBy: { date: "desc" } } },
  });

  if (!student) {
    return (
      <>
        <PageHeader title="Achievements" />
        <Panel>
          <EmptyState title="No student profile linked" hint="Your account isn't linked to a student record yet." icon={<Trophy className="h-8 w-8" />} />
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader title="My Achievements" subtitle="Milestones and wins along your journey" />

      <Panel>
        {student.achievements.length === 0 ? (
          <EmptyState title="No achievements yet" hint="Keep working towards your goals — your wins will show up here!" icon={<Trophy className="h-8 w-8" />} />
        ) : (
          <div className="relative space-y-1 before:absolute before:bottom-3 before:left-[15px] before:top-3 before:w-px before:bg-slate-100">
            {student.achievements.map((a) => (
              <div key={a.id} className="relative flex gap-4 py-3">
                <span className="relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15">
                  <Trophy className="h-4 w-4 text-gold" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold text-navy">{a.title}</p>
                    {a.category && <Badge tone="gold">{a.category}</Badge>}
                  </div>
                  {a.description && <p className="mt-0.5 text-sm text-slate-500">{a.description}</p>}
                  <p className="mt-0.5 text-xs text-slate-400">{fmtDate(a.date)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
