import { redirect } from "next/navigation";
import { FolderOpen, Download } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { PageHeader, Avatar, Badge, EmptyState } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { fmtDate, titleCase } from "@/lib/utils";

export default async function ParentDocumentsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const children = await prisma.student.findMany({
    where: { parentId: session.userId },
    select: { id: true },
  });
  const childIds = children.map((c) => c.id);

  const documents = childIds.length
    ? await prisma.studentDocument.findMany({
        where: { studentId: { in: childIds } },
        orderBy: { createdAt: "desc" },
        include: { student: true },
      })
    : [];

  return (
    <>
      <PageHeader title="Documents" subtitle="Files and records shared for your children" />

      <Panel>
        {documents.length === 0 ? (
          <EmptyState
            title="No documents yet"
            hint="Certificates, reports and records will appear here."
            icon={<FolderOpen className="h-8 w-8" />}
          />
        ) : (
          <DataTable
            rows={documents}
            getKey={(d) => d.id}
            columns={[
              {
                header: "Child",
                cell: (d) => (
                  <div className="flex items-center gap-2.5">
                    <Avatar name={d.student.fullName} src={d.student.photo} size={32} tint="#6d28d9" />
                    <span className="font-medium text-slate-700">{d.student.fullName}</span>
                  </div>
                ),
              },
              { header: "Title", cell: (d) => <span className="font-semibold text-navy">{d.title}</span> },
              { header: "Type", cell: (d) => <Badge tone="slate">{titleCase(d.type)}</Badge> },
              { header: "Date", cell: (d) => fmtDate(d.createdAt) },
              {
                header: "",
                className: "text-right",
                cell: (d) => (
                  <a
                    href={d.fileUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-outline text-xs"
                  >
                    <Download className="h-3.5 w-3.5" /> View
                  </a>
                ),
              },
            ]}
          />
        )}
      </Panel>
    </>
  );
}
