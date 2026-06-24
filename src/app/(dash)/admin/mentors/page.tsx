import { Star, GraduationCap, Users, CalendarDays } from "lucide-react";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard, Avatar, Badge } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { SearchBar } from "@/components/ui/SearchBar";
import { StatusBadge } from "@/components/ui/StatusBadge";

export default async function MentorsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  const where: Prisma.UserWhereInput = {
    role: "MENTOR",
    ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }] } : {}),
  };

  const mentors = await prisma.user.findMany({
    where,
    orderBy: { name: "asc" },
    include: {
      manager: true,
      institution: true,
      _count: { select: { studentsAsMentor: true, mentoredSessions: true } },
    },
  });

  // average feedback rating per mentor
  const ratings = await prisma.feedback.groupBy({
    by: ["mentorId"],
    where: { mentorId: { in: mentors.map((m) => m.id) }, rating: { not: null } },
    _avg: { rating: true },
  });
  const ratingMap = new Map(ratings.map((r) => [r.mentorId, r._avg.rating ?? null]));

  const totalMentors = mentors.length;
  const totalMentees = mentors.reduce((a, m) => a + m._count.studentsAsMentor, 0);
  const totalSessions = mentors.reduce((a, m) => a + m._count.mentoredSessions, 0);
  const ratedVals = ratings.map((r) => r._avg.rating).filter((v): v is number => v != null);
  const avgRating = ratedVals.length ? ratedVals.reduce((a, b) => a + b, 0) / ratedVals.length : null;

  return (
    <>
      <PageHeader
        title="Mentors"
        subtitle="Mentor roster with mentee load, supervision & performance"
        action={<SearchBar placeholder="Search mentors" />}
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Mentors" value={totalMentors} icon={<GraduationCap className="h-5 w-5" />} tint="#2FA84F" />
        <StatCard label="Mentees Assigned" value={totalMentees} icon={<Users className="h-5 w-5" />} tint="#1E50A2" />
        <StatCard label="Sessions Conducted" value={totalSessions} icon={<CalendarDays className="h-5 w-5" />} tint="#E0A92E" />
        <StatCard
          label="Avg Feedback Rating"
          value={avgRating != null ? `${avgRating.toFixed(1)} / 5` : "—"}
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
                  <div className="flex items-center gap-3">
                    <Avatar name={m.name} src={m.avatar} size={36} tint="#2FA84F" />
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-700">{m.name}</p>
                      <p className="truncate text-xs text-slate-400">{m.email}</p>
                    </div>
                  </div>
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
            ]}
          />
        </Panel>
      </div>
    </>
  );
}
