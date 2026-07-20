import Link from "next/link";
import { Star, GraduationCap, Users, CalendarDays, UserPlus, Pencil } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getPerms } from "@/lib/permissions";
import { saveUser, deleteUser } from "@/lib/actions";
import { PageHeader, StatCard, Avatar, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { SubmitButton } from "@/components/ui/form";
import { Pagination } from "@/components/ui/Pagination";
import { MentorFormFields } from "./MentorFormFields";

const PAGE_SIZE = 10;

export default async function MentorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const perms = await getPerms("mentors");

  const where: Prisma.UserWhereInput = {
    role: "MENTOR",
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
  };

  const [mentors, total, institutions, supervisors] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        manager: true,
        institution: true,
        _count: { select: { studentsAsMentor: true, mentoredSessions: true } },
      },
    }),
    prisma.user.count({ where }),
    prisma.institution.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: { in: ["SUPERVISOR", "CHIEF_MENTOR"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  // average feedback rating per mentor (current page only)
  const ratings = await prisma.feedback.groupBy({
    by: ["mentorId"],
    where: { mentorId: { in: mentors.map((m) => m.id) }, rating: { not: null } },
    _avg: { rating: true },
  });
  const ratingMap = new Map(ratings.map((r) => [r.mentorId, r._avg.rating ?? null]));

  const [totalMentors, totalMentees, totalSessions, avgRatingAgg] = await Promise.all([
    prisma.user.count({ where: { role: "MENTOR" } }),
    prisma.student.count({ where: { mentorId: { not: null } } }),
    prisma.mentoringSession.count(),
    prisma.feedback.aggregate({ where: { rating: { not: null } }, _avg: { rating: true } }),
  ]);

  return (
    <>
      <PageHeader
        title="Mentors"
        subtitle="Mentor roster with mentee load, supervision & performance"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <SearchBar placeholder="Search mentors" />
            {perms.create && <AddMentorModal institutions={institutions} supervisors={supervisors} />}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Mentors" value={totalMentors} icon={<GraduationCap className="h-5 w-5" />} tint="#2FA84F" />
        <StatCard label="Mentees Assigned" value={totalMentees} icon={<Users className="h-5 w-5" />} tint="#1E50A2" />
        <StatCard label="Sessions Conducted" value={totalSessions} icon={<CalendarDays className="h-5 w-5" />} tint="#E0A92E" />
        <StatCard
          label="Avg Feedback Rating"
          value={avgRatingAgg._avg.rating != null ? `${avgRatingAgg._avg.rating.toFixed(1)} / 5` : "—"}
          icon={<Star className="h-5 w-5" />}
          tint="#6d28d9"
        />
      </div>

      <div className="mt-4">
        <Panel>
          <DataTable
            rows={mentors}
            getKey={(m) => m.id}
            empty="No mentors found."
            columns={[
              {
                header: "Mentor",
                cell: (m) => (
                  <Link href={`/admin/mentors/${m.id}`} className="flex items-center gap-3 hover:opacity-80">
                    <Avatar name={m.name} src={m.avatar} size={36} tint="#2FA84F" />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-700">{m.name}</p>
                      <p className="truncate text-xs text-slate-400">{m.email}</p>
                    </div>
                  </Link>
                ),
              },
              {
                header: "Institution",
                cell: (m) => <span className="text-slate-600">{m.institution?.name ?? "—"}</span>,
              },
              {
                header: "Mentees",
                cell: (m) => <Badge tone="blue">{m._count.studentsAsMentor}</Badge>,
              },
              {
                header: "Supervisor",
                cell: (m) => <span className="text-slate-600">{m.manager?.name ?? "—"}</span>,
              },
              {
                header: "Sessions",
                cell: (m) => <span className="font-medium text-slate-600">{m._count.mentoredSessions}</span>,
              },
              {
                header: "Rating",
                cell: (m) => {
                  const r = ratingMap.get(m.id);
                  return r != null ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-gold">
                      <Star className="h-3.5 w-3.5 fill-current" /> {r.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  );
                },
              },
              { header: "Status", cell: (m) => <StatusBadge status={m.status} /> },
              {
                header: "Actions",
                cell: (m) => (
                  <div className="flex items-center gap-1">
                    {perms.edit && (
                      <Modal
                        wide
                        title="Edit Mentor"
                        triggerClassName="btn-ghost text-xs"
                        triggerLabel={<><Pencil className="h-3.5 w-3.5" /> Edit</>}
                      >
                        <ActionForm action={saveUser} className="space-y-4" successMessage="Mentor updated.">
                          <MentorFormFields mentor={m} institutions={institutions} supervisors={supervisors} isCreate={false} />
                          <div className="flex justify-end gap-2 pt-2">
                            <SubmitButton>Save changes</SubmitButton>
                          </div>
                        </ActionForm>
                      </Modal>
                    )}
                    {perms.delete && (
                      <ConfirmDeleteButton
                        action={deleteUser}
                        hiddenFields={{ id: m.id }}
                        itemLabel={m.name}
                        warning={
                          m._count.studentsAsMentor > 0
                            ? `${m._count.studentsAsMentor} student(s) will be unassigned from this mentor. This is permanent.`
                            : "This is permanent and cannot be undone."
                        }
                        successMessage="Mentor deleted."
                        triggerClassName="btn-ghost text-xs text-red-600"
                      />
                    )}
                    {!perms.edit && !perms.delete && <span className="text-xs text-slate-300">—</span>}
                  </div>
                ),
              },
            ]}
          />
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} basePath="/admin/mentors" searchParams={{ q }} />
        </Panel>
      </div>
    </>
  );
}

function AddMentorModal({
  institutions,
  supervisors,
}: {
  institutions: { id: string; name: string }[];
  supervisors: { id: string; name: string }[];
}) {
  return (
    <Modal wide title="Add Mentor" triggerClassName="btn-primary" triggerLabel={<><UserPlus className="h-4 w-4" /> Add Mentor</>}>
      <ActionForm action={saveUser} className="space-y-4" successMessage="Mentor created.">
        <MentorFormFields institutions={institutions} supervisors={supervisors} isCreate />
        <div className="flex justify-end gap-2 pt-2">
          <SubmitButton>Create mentor</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}
