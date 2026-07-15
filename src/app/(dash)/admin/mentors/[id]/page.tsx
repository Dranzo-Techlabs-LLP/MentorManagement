import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft, Mail, Phone, MapPin, Building2, Users, Star, CalendarDays,
  Globe, Clock, Languages, Award, UserPlus, UserX, Pencil,
} from "lucide-react";
import { prisma } from "@/lib/db";
import { saveUser, deleteUser, assignMentor } from "@/lib/actions";
import { PageHeader, Avatar, Badge, EmptyState } from "@/components/ui/primitives";
import { Panel, MiniMetric } from "@/components/dash/widgets";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { ConfirmDeleteButton } from "@/components/ui/ConfirmDeleteButton";
import { SubmitButton, Field } from "@/components/ui/form";
import { MentorFormFields } from "../MentorFormFields";
import { fmtDate, titleCase } from "@/lib/utils";

export default async function MentorProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const mentor = await prisma.user.findFirst({
    where: { id, role: "MENTOR" },
    include: {
      institution: true,
      manager: true,
      studentsAsMentor: {
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true, photo: true, className: true, status: true, ageCategory: true, city: true },
      },
      _count: { select: { studentsAsMentor: true, mentoredSessions: true } },
    },
  });
  if (!mentor) notFound();

  const [ratingAgg, institutions, supervisors, otherStudents] = await Promise.all([
    prisma.feedback.aggregate({ where: { mentorId: id, rating: { not: null } }, _avg: { rating: true }, _count: { rating: true } }),
    prisma.institution.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: { in: ["SUPERVISOR", "CHIEF_MENTOR"] } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.student.findMany({
      where: { mentorId: { not: id } },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, mentor: { select: { name: true } } },
    }),
  ]);

  return (
    <>
      <Link href="/admin/mentors" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-navy">
        <ArrowLeft className="h-4 w-4" /> Back to mentors
      </Link>

      <div className="card mb-5 p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={mentor.name} src={mentor.avatar} size={88} tint="#2FA84F" />
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-extrabold text-navy">{mentor.name}</h1>
              <StatusBadge status={mentor.status} />
              {mentor.mentoringMode && <Badge tone="teal">{titleCase(mentor.mentoringMode)}</Badge>}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {mentor.title ?? "Mentor"}
              {mentor.institution && ` · ${mentor.institution.name}`}
            </p>

            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <InfoLine icon={<Mail className="h-4 w-4" />} label="Email" value={mentor.email} />
              <InfoLine icon={<Phone className="h-4 w-4" />} label="Phone" value={mentor.phone ?? "—"} />
              <InfoLine icon={<Building2 className="h-4 w-4" />} label="Supervisor" value={mentor.manager?.name ?? "—"} />
              <InfoLine icon={<MapPin className="h-4 w-4" />} label="City" value={mentor.city ?? "—"} />
              <InfoLine icon={<Clock className="h-4 w-4" />} label="Time zone" value={mentor.timezone ?? "—"} />
              <InfoLine icon={<Languages className="h-4 w-4" />} label="Languages" value={mentor.languages ?? "—"} />
              <InfoLine icon={<Globe className="h-4 w-4" />} label="Exposure" value={mentor.exposure ?? "—"} />
              <InfoLine icon={<Award className="h-4 w-4" />} label="Experience" value={mentor.yearsExperience != null ? `${mentor.yearsExperience} yrs` : "—"} />
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2">
            <EditMentorModal mentor={mentor} institutions={institutions} supervisors={supervisors} />
            <ConfirmDeleteButton
              action={deleteUser}
              hiddenFields={{ id: mentor.id }}
              itemLabel={mentor.name}
              warning={
                mentor._count.studentsAsMentor > 0
                  ? `This mentor has ${mentor._count.studentsAsMentor} student(s) assigned — they will be unassigned. This is permanent and cannot be undone.`
                  : "This is permanent and cannot be undone."
              }
              triggerClassName="btn-outline text-red-600"
            />
          </div>
        </div>
      </div>

      <PageHeader title="Mentor Profile" subtitle="Assigned mentees, workload &amp; performance" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MiniMetric label="Mentees Assigned" value={mentor._count.studentsAsMentor} sub="Currently active" />
        <MiniMetric label="Sessions Conducted" value={mentor._count.mentoredSessions} sub="All time" />
        <MiniMetric
          label="Avg Feedback Rating"
          value={ratingAgg._avg.rating != null ? `${ratingAgg._avg.rating.toFixed(1)} / 5` : "—"}
          sub={`${ratingAgg._count.rating} rating(s)`}
        />
        <MiniMetric label="Member Since" value={fmtDate(mentor.createdAt)} sub={mentor.lastLogin ? `Last login ${fmtDate(mentor.lastLogin)}` : "Never logged in"} />
      </div>

      <div className="mt-4">
        <Panel
          title="Assigned Students"
          action={<AssignStudentModal mentorId={mentor.id} students={otherStudents} />}
        >
          {mentor.studentsAsMentor.length === 0 ? (
            <EmptyState
              title="No students assigned to this mentor yet"
              hint="Use “Assign Student” to add a mentee to this mentor's caseload."
              icon={<Users className="h-8 w-8" />}
            />
          ) : (
            <div className="divide-y divide-slate-50">
              {mentor.studentsAsMentor.map((st) => (
                <div key={st.id} className="flex items-center justify-between gap-3 py-3">
                  <Link href={`/admin/students/${st.id}`} className="flex min-w-0 items-center gap-3 hover:opacity-80">
                    <Avatar name={st.fullName} src={st.photo} size={38} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-navy">{st.fullName}</p>
                      <p className="truncate text-xs text-slate-400">
                        {st.className ?? "—"}{st.city ? ` · ${st.city}` : ""}
                      </p>
                    </div>
                  </Link>
                  <div className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={st.status} />
                    <ActionForm action={assignMentor} className="inline-flex">
                      <input type="hidden" name="studentId" value={st.id} />
                      <input type="hidden" name="mentorId" value="" />
                      <SubmitButton className="btn-ghost text-xs text-red-600" pendingText="…">
                        <UserX className="h-3.5 w-3.5" /> Unassign
                      </SubmitButton>
                    </ActionForm>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function InfoLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-slate-400">{icon}</span>
      <span className="text-slate-400">{label}:</span>
      <span className="truncate font-medium text-slate-700">{value}</span>
    </div>
  );
}

function EditMentorModal({
  mentor,
  institutions,
  supervisors,
}: {
  mentor: React.ComponentProps<typeof MentorFormFields>["mentor"];
  institutions: { id: string; name: string }[];
  supervisors: { id: string; name: string }[];
}) {
  return (
    <Modal wide title="Edit Mentor" triggerClassName="btn-outline" triggerLabel={<><Pencil className="h-4 w-4" /> Edit</>}>
      <ActionForm action={saveUser} className="space-y-4" successMessage="Mentor updated.">
        <MentorFormFields mentor={mentor} institutions={institutions} supervisors={supervisors} isCreate={false} />
        <div className="flex justify-end gap-2 pt-2">
          <SubmitButton>Save changes</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}

function AssignStudentModal({
  mentorId,
  students,
}: {
  mentorId: string;
  students: { id: string; fullName: string; mentor: { name: string } | null }[];
}) {
  return (
    <Modal title="Assign Student" triggerClassName="btn-outline text-xs" triggerLabel={<><UserPlus className="h-3.5 w-3.5" /> Assign Student</>}>
      <ActionForm action={assignMentor} className="space-y-4" successMessage="Student assigned.">
        <input type="hidden" name="mentorId" value={mentorId} />
        <Field label="Student" hint="Reassigning a student who already has a mentor will move them to this mentor.">
          <select name="studentId" className="input" required defaultValue="">
            <option value="" disabled>— Select a student —</option>
            {students.map((st) => (
              <option key={st.id} value={st.id}>
                {st.fullName}{st.mentor ? ` (currently with ${st.mentor.name})` : ""}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex justify-end">
          <SubmitButton>Assign</SubmitButton>
        </div>
      </ActionForm>
    </Modal>
  );
}
