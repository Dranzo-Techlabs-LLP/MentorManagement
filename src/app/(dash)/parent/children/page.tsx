import Link from "next/link";
import { redirect } from "next/navigation";
import { Users, ArrowRight } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, Avatar, Progress, EmptyState, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ageFromDob } from "@/lib/utils";

function avgScore(records: { score: number | null }[]) {
  const scored = records.filter((r) => r.score != null);
  if (!scored.length) return 0;
  return Math.round(scored.reduce((a, r) => a + (r.score ?? 0), 0) / scored.length);
}

export default async function ParentChildrenPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const children = await prisma.student.findMany({
    where: { parentId: session.userId },
    orderBy: { fullName: "asc" },
    include: {
      mentor: true,
      institution: true,
      growthRecords: { select: { score: true } },
      _count: { select: { goals: true, achievements: true, assessments: true } },
    },
  });

  return (
    <>
      <PageHeader title="My Children" subtitle="Your children enrolled in the SLEP program" />

      {children.length === 0 ? (
        <Panel>
          <EmptyState
            title="No children linked yet"
            hint="Once your application is approved, your child's profile will appear here."
            icon={<Users className="h-8 w-8" />}
          />
        </Panel>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {children.map((c) => {
            const avg = avgScore(c.growthRecords);
            const age = ageFromDob(c.dob);
            return (
              <div key={c.id} className="card flex flex-col p-5">
                <div className="flex items-center gap-3">
                  <Avatar name={c.fullName} src={c.photo} size={52} tint="#6d28d9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-navy">{c.fullName}</p>
                    <p className="truncate text-xs text-slate-400">
                      {c.className ?? "—"}
                      {age != null ? ` · Age ${age}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                    <span>Overall growth</span>
                    <span className="font-semibold text-slate-600">{avg}%</span>
                  </div>
                  <Progress value={avg} color="#6d28d9" />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                  <Stat label="Goals" value={c._count.goals} />
                  <Stat label="Awards" value={c._count.achievements} />
                  <Stat label="Tests" value={c._count.assessments} />
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-400">
                  <span className="truncate">
                    {c.mentor ? (
                      <>Mentor: <Badge tone="teal">{c.mentor.name}</Badge></>
                    ) : (
                      "No mentor assigned"
                    )}
                  </span>
                </div>

                <Link
                  href={`/parent/children/${c.id}`}
                  className="btn-primary mt-4 w-full justify-center"
                >
                  View Profile <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 py-2">
      <p className="text-lg font-extrabold text-navy">{value}</p>
      <p className="text-[11px] text-slate-400">{label}</p>
    </div>
  );
}
