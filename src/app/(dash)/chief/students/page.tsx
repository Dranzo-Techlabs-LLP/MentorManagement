import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, Avatar } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CATEGORY_LABEL } from "@/lib/utils";

/** All students enrolled in the program. */
export default async function ChiefStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");
  const { q } = await searchParams;

  const where: Prisma.StudentWhereInput = q ? { fullName: { contains: q } } : {};

  const students = await prisma.student.findMany({
    where,
    orderBy: { fullName: "asc" },
    include: { mentor: true, institution: true },
  });

  return (
    <>
      <PageHeader
        title="Students"
        subtitle="All students enrolled in the program"
        action={<SearchBar placeholder="Search students" />}
      />

      <Panel>
        <DataTable
          rows={students}
          getKey={(s) => s.id}
          empty="No students found."
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
            { header: "Institution", cell: (s) => <span className="text-slate-600">{s.institution?.name ?? "—"}</span> },
            { header: "Status", cell: (s) => <StatusBadge status={s.status} /> },
          ]}
        />
      </Panel>
    </>
  );
}
