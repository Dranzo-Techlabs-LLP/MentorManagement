import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, Avatar, Progress } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CATEGORY_LABEL } from "@/lib/utils";

/** Students mentored by any of the supervisor's mentors. */
export default async function SupervisorStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { q } = await searchParams;

  const mentorIds = (
    await prisma.user.findMany({
      where: { managerId: session.userId, role: "MENTOR" },
      select: { id: true },
    })
  ).map((m) => m.id);

  const where: Prisma.StudentWhereInput = {
    mentorId: { in: mentorIds.length ? mentorIds : ["__none__"] },
    ...(q ? { fullName: { contains: q } } : {}),
  };

  const students = await prisma.student.findMany({
    where,
    orderBy: { fullName: "asc" },
    include: { mentor: true },
  });

  // average growth score per student
  const growth = students.length
    ? await prisma.growthRecord.groupBy({
        by: ["studentId"],
        where: { studentId: { in: students.map((s) => s.id) }, score: { not: null } },
        _avg: { score: true },
      })
    : [];
  const growthMap = new Map(growth.map((g) => [g.studentId, Math.round(g._avg.score ?? 0)]));

  return (
    <>
      <PageHeader
        title="My Students"
        subtitle="Students mentored by your team"
        action={<SearchBar placeholder="Search students" />}
      />

      <Panel>
        <DataTable
          rows={students}
          getKey={(s) => s.id}
          empty="No students under your mentors."
          columns={[
            {
              header: "Student",
              cell: (s) => (
                <div className="flex items-center gap-3">
                  <Avatar name={s.fullName} src={s.photo} size={36} />
                  <div className="min-w-0">
                    <p className="font-semibold text-navy">{s.fullName}</p>
                    {s.rollNo && <p className="truncate text-xs text-slate-400">Roll {s.rollNo}</p>}
                  </div>
                </div>
              ),
            },
            { header: "Class", cell: (s) => <span className="text-slate-600">{s.className ?? "—"}</span> },
            {
              header: "Level",
              cell: (s) => (
                <span className="text-xs text-slate-500">
                  {s.ageCategory ? CATEGORY_LABEL[s.ageCategory] : "—"}
                </span>
              ),
            },
            { header: "Mentor", cell: (s) => <span className="text-slate-600">{s.mentor?.name ?? "—"}</span> },
            {
              header: "Growth",
              className: "w-40",
              cell: (s) => {
                const v = growthMap.get(s.id) ?? 0;
                return (
                  <div className="flex items-center gap-2">
                    <Progress value={v} />
                    <span className="w-9 shrink-0 text-xs font-semibold text-slate-500">{v}%</span>
                  </div>
                );
              },
            },
            { header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
          ]}
        />
      </Panel>
    </>
  );
}
