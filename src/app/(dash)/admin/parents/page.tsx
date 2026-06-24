import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PageHeader, Avatar, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function ParentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const where: Prisma.UserWhereInput = {
    role: "PARENT",
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
  };

  const parents = await prisma.user.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      studentsAsParent: { select: { id: true, fullName: true } },
    },
  });

  return (
    <>
      <PageHeader
        title="Parents"
        subtitle="Guardian accounts and their enrolled children"
        action={<SearchBar placeholder="Search parents" />}
      />

      <Panel>
        <DataTable
          rows={parents}
          getKey={(p) => p.id}
          empty="No parents found."
          columns={[
            {
              header: "Parent",
              cell: (p) => (
                <div className="flex items-center gap-3">
                  <Avatar name={p.name} src={p.avatar} size={36} tint="#6d28d9" />
                  <p className="font-semibold text-slate-700">{p.name}</p>
                </div>
              ),
            },
            { header: "Email", cell: (p) => <span className="text-slate-600">{p.email}</span> },
            { header: "Phone", cell: (p) => <span className="text-slate-600">{p.phone ?? "—"}</span> },
            {
              header: "Children",
              cell: (p) => <Badge tone="blue">{p.studentsAsParent.length}</Badge>,
            },
            {
              header: "Children Names",
              cell: (p) =>
                p.studentsAsParent.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {p.studentsAsParent.map((s) => (
                      <Link
                        key={s.id}
                        href={`/admin/students/${s.id}`}
                        className="rounded-md bg-slate-50 px-2 py-0.5 text-xs font-medium text-navy hover:bg-navy-50"
                      >
                        {s.fullName}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <span className="text-slate-400">—</span>
                ),
            },
            { header: "Status", cell: (p) => <StatusBadge status={p.status} /> },
          ]}
        />
      </Panel>
    </>
  );
}
