"use server";

import { revalidatePath } from "next/cache";
import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import { prisma } from "./db";
import { getSession, hashPassword, verifyPassword, createSessionCookie } from "./auth";
import { requireSession, requireRole } from "./guard";
import { requirePermission, requireSuperAdmin } from "./permissions";
import { RESOURCES, DEFAULT_MATRIX, resourceForRole } from "./permission-data";
import { ageFromDob, ageCategory } from "./utils";
import { studentInputSchema, mentorInputSchema, institutionInputSchema, zodFieldError } from "./validation";
import type { Prisma, AgeCategory, Role } from "@prisma/client";

type Result = { ok: boolean; error?: string; id?: string };

// ---- local helpers (not exported) ----
const s = (fd: FormData, k: string) => (fd.get(k)?.toString() || "").trim();
const sn = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v ? v : null;
};
const num = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v ? Number(v) : null;
};
const date = (fd: FormData, k: string) => {
  const v = s(fd, k);
  return v ? new Date(v) : null;
};

function touch(...paths: string[]) {
  for (const p of paths) revalidatePath(p);
}

async function notify(userId: string, title: string, message: string, link?: string, type = "info") {
  if (!userId) return;
  await prisma.notification.create({ data: { userId, title, message, link, type } });
}

async function log(action: string, entity: string, entityId?: string, meta?: Prisma.InputJsonValue) {
  const sess = await getSession();
  await prisma.auditLog.create({ data: { userId: sess?.userId, action, entity, entityId, meta } }).catch(() => {});
}

// ============================================================================
// PUBLIC — parent application
// ============================================================================
export async function submitApplication(fd: FormData): Promise<Result> {
  const parentName = s(fd, "parentName");
  const parentEmail = s(fd, "parentEmail");
  const parentPhone = s(fd, "parentPhone");
  const studentName = s(fd, "studentName");
  if (!parentName || !parentEmail || !parentPhone || !studentName)
    return { ok: false, error: "Please fill all required fields." };

  const app = await prisma.parentApplication.create({
    data: {
      parentName, parentEmail, parentPhone, studentName,
      studentGender: sn(fd, "studentGender"),
      studentDob: date(fd, "studentDob"),
      institutionName: sn(fd, "institutionName"),
      className: sn(fd, "className"),
      message: sn(fd, "message"),
    },
  });
  const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
  for (const a of admins)
    await notify(a.id, "New parent application", `${parentName} applied for ${studentName}.`, "/admin/applications", "info");
  touch("/admin/applications", "/admin");
  return { ok: true, id: app.id };
}

// ============================================================================
// APPLICATIONS — admin review
// ============================================================================
export async function approveApplication(fd: FormData): Promise<Result> {
  await requirePermission("applications", "edit");
  const id = s(fd, "id");
  const app = await prisma.parentApplication.findUnique({ where: { id } });
  if (!app) return { ok: false, error: "Application not found" };

  const mentorId = sn(fd, "mentorId");
  const institutionId = sn(fd, "institutionId");

  // find or create parent user
  let parent = await prisma.user.findUnique({ where: { email: app.parentEmail.toLowerCase() } });
  if (!parent) {
    parent = await prisma.user.create({
      data: {
        name: app.parentName, email: app.parentEmail.toLowerCase(),
        passwordHash: await hashPassword("Elevate@123"), role: "PARENT", phone: app.parentPhone,
      },
    });
  }
  const age = ageFromDob(app.studentDob);
  const student = await prisma.student.create({
    data: {
      fullName: app.studentName, gender: app.studentGender, dob: app.studentDob,
      ageCategory: ageCategory(age) as Prisma.StudentCreateInput["ageCategory"],
      className: app.className, parentId: parent.id, mentorId, institutionId, status: "ACTIVE",
    },
  });
  await prisma.parentApplication.update({
    where: { id }, data: { status: "APPROVED", reviewedById: (await getSession())!.userId, createdStudentId: student.id },
  });
  await notify(parent.id, "Application approved", `${app.studentName} has been enrolled in SLEP.`, "/parent");
  await log("APPROVE", "ParentApplication", id);
  touch("/admin/applications", "/admin/students", "/admin", "/parent");
  return { ok: true, id: student.id };
}

export async function rejectApplication(fd: FormData): Promise<Result> {
  await requirePermission("applications", "edit");
  const id = s(fd, "id");
  await prisma.parentApplication.update({
    where: { id }, data: { status: "REJECTED", reviewNote: sn(fd, "reviewNote"), reviewedById: (await getSession())!.userId },
  });
  await log("REJECT", "ParentApplication", id);
  touch("/admin/applications");
  return { ok: true };
}

export async function deleteApplication(fd: FormData): Promise<Result> {
  await requirePermission("applications", "delete");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing application." };
  const app = await prisma.parentApplication.findUnique({ where: { id }, select: { studentName: true } });
  if (!app) return { ok: false, error: "Application not found." };
  await prisma.parentApplication.delete({ where: { id } });
  await log("DELETE", "ParentApplication", id, { studentName: app.studentName });
  touch("/admin/applications");
  return { ok: true };
}

// ============================================================================
// STUDENTS
// ============================================================================
export async function saveStudent(fd: FormData): Promise<Result> {
  const id = sn(fd, "id");
  await requirePermission("students", id ? "edit" : "create");

  const parsed = studentInputSchema.safeParse({
    fullName: s(fd, "fullName"), email: sn(fd, "email"), phone: sn(fd, "phone"), dob: sn(fd, "dob"),
  });
  if (!parsed.success) return { ok: false, error: zodFieldError(parsed) };

  const institutionId = sn(fd, "institutionId");
  const mentorId = sn(fd, "mentorId");
  const parentId = sn(fd, "parentId");
  const [inst, mentorUser, parentUser] = await Promise.all([
    institutionId ? prisma.institution.findUnique({ where: { id: institutionId } }) : null,
    mentorId ? prisma.user.findUnique({ where: { id: mentorId } }) : null,
    parentId ? prisma.user.findUnique({ where: { id: parentId } }) : null,
  ]);
  if (institutionId && !inst) return { ok: false, error: "Selected institution does not exist." };
  if (mentorId && (!mentorUser || mentorUser.role !== "MENTOR")) return { ok: false, error: "Selected mentor is invalid." };
  if (parentId && (!parentUser || parentUser.role !== "PARENT")) return { ok: false, error: "Selected parent is invalid." };

  const dob = date(fd, "dob");
  const data = {
    fullName: s(fd, "fullName"), gender: sn(fd, "gender"), dob,
    ageCategory: ageCategory(ageFromDob(dob)) as AgeCategory | null,
    email: sn(fd, "email"), phone: sn(fd, "phone"), className: sn(fd, "className"),
    rollNo: sn(fd, "rollNo"), city: sn(fd, "city"), bloodGroup: sn(fd, "bloodGroup"),
    address: sn(fd, "address"), interests: sn(fd, "interests"), talents: sn(fd, "talents"),
    institutionId: sn(fd, "institutionId"), mentorId: sn(fd, "mentorId"), parentId: sn(fd, "parentId"),
    // mentoring record — identity & academics
    registrationNumber: sn(fd, "registrationNumber"), yearOfStudy: sn(fd, "yearOfStudy"),
    // family & educational background
    fatherOccupation: sn(fd, "fatherOccupation"), motherOccupation: sn(fd, "motherOccupation"),
    plusTwoPercentage: sn(fd, "plusTwoPercentage"), languagesKnown: sn(fd, "languagesKnown"),
    // interests, talents & aspirations
    sports: sn(fd, "sports"), cultural: sn(fd, "cultural"), hobbies: sn(fd, "hobbies"),
    careerAspiration: sn(fd, "careerAspiration"), otherTalent: sn(fd, "otherTalent"), lifeGoal: sn(fd, "lifeGoal"),
    // additional information
    problems: sn(fd, "problems"), healthProblems: sn(fd, "healthProblems"), mentorRemarks: sn(fd, "mentorRemarks"),
    // mentoring preference
    preferredMode: (sn(fd, "preferredMode") || null) as Prisma.StudentCreateInput["preferredMode"],
  };
  let res;
  if (id) res = await prisma.student.update({ where: { id }, data });
  else res = await prisma.student.create({ data });
  await log(id ? "UPDATE" : "CREATE", "Student", res.id);
  touch("/admin/students", `/admin/students/${res.id}`, "/admin", "/mentor/mentees");
  return { ok: true, id: res.id };
}

export async function deleteStudent(fd: FormData): Promise<Result> {
  await requirePermission("students", "delete");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing student." };
  const student = await prisma.student.findUnique({ where: { id }, select: { fullName: true } });
  if (!student) return { ok: false, error: "Student not found." };

  try {
    await prisma.student.delete({ where: { id } });
  } catch {
    return { ok: false, error: "Could not delete this student — please try again or contact support." };
  }
  await log("DELETE", "Student", id, { fullName: student.fullName });
  touch("/admin/students", "/mentor/mentees", "/admin");
  return { ok: true };
}

// SWOC analysis — mentor/staff create or update a mentee's SWOC (one per student).
export async function upsertSwoc(fd: FormData): Promise<Result> {
  const sess = await requirePermission("portfolio", "edit");
  const studentId = s(fd, "studentId");
  if (!studentId) return { ok: false, error: "Missing student." };
  const data = {
    strengths: sn(fd, "strengths"), weaknesses: sn(fd, "weaknesses"),
    opportunities: sn(fd, "opportunities"), challenges: sn(fd, "challenges"),
    updatedById: sess.userId,
  };
  await prisma.studentSwoc.upsert({
    where: { studentId },
    create: { studentId, ...data },
    update: data,
  });
  await log("UPSERT", "StudentSwoc", studentId);
  touch(`/admin/students/${studentId}`, `/mentor/mentees/${studentId}`);
  return { ok: true };
}

// ============================================================================
// USERS (staff / parents)
// ============================================================================
export async function saveUser(fd: FormData): Promise<Result> {
  const id = sn(fd, "id");
  const targetRole = s(fd, "role") as Role;
  const sess = await requirePermission(resourceForRole(targetRole), id ? "edit" : "create");
  const isSelfEdit = !!id && id === sess.userId;

  const parsed = mentorInputSchema.safeParse({
    name: s(fd, "name"), email: s(fd, "email"), phone: sn(fd, "phone"), yearsExperience: sn(fd, "yearsExperience"),
  });
  if (!parsed.success) return { ok: false, error: zodFieldError(parsed) };
  const email = parsed.data.email;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== id) return { ok: false, error: "Email already in use." };

  const base = {
    name: parsed.data.name, email, role: s(fd, "role") as Prisma.UserCreateInput["role"],
    phone: sn(fd, "phone"), title: sn(fd, "title"), institutionId: sn(fd, "institutionId"),
    managerId: sn(fd, "managerId"),
    // mentor profile & matching
    mentoringMode: (sn(fd, "mentoringMode") || null) as Prisma.UserCreateInput["mentoringMode"],
    city: sn(fd, "city"), timezone: sn(fd, "timezone"), languages: sn(fd, "languages"),
    exposure: sn(fd, "exposure"), yearsExperience: parsed.data.yearsExperience ?? null,
    // RBAC permission role (empty → fall back to system role for the workspace role)
    appRoleId: sn(fd, "appRoleId"),
  };
  if (id) {
    // Only update fields the submitting form actually contained — partial forms
    // (e.g. the Parent modal, which has no institution/manager/mentor fields)
    // must not null out values they never showed.
    const data = Object.fromEntries(
      Object.entries(base).filter(
        ([key]) =>
          (key === "name" || key === "email" || fd.has(key)) &&
          // lockout protection: never let a user change their own role/permission role
          !(isSelfEdit && (key === "role" || key === "appRoleId")),
      ),
    ) as Prisma.UserUpdateInput;
    await prisma.user.update({ where: { id }, data });
    await log("UPDATE", "User", id, { role: base.role });
    touch("/admin/users", "/admin/mentors", "/admin/parents", "/chief/mentors", "/supervisor/mentors", `/admin/mentors/${id}`);
    return { ok: true, id };
  }
  const pwd = s(fd, "password") || "Elevate@123";
  const user = await prisma.user.create({ data: { ...base, passwordHash: await hashPassword(pwd) } });
  await log("CREATE", "User", user.id, { role: base.role });
  touch("/admin/users", "/admin/mentors", "/admin/parents", "/chief/mentors", "/supervisor/mentors");
  return { ok: true, id: user.id };
}

export async function setUserStatus(fd: FormData): Promise<Result> {
  const id = s(fd, "id");
  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) return { ok: false, error: "User not found." };
  await requirePermission(resourceForRole(target.role), "edit");
  await prisma.user.update({ where: { id }, data: { status: s(fd, "status") as Prisma.UserUpdateInput["status"] } });
  touch("/admin/users", "/admin/mentors", `/admin/mentors/${id}`);
  return { ok: true };
}

export async function deleteUser(fd: FormData): Promise<Result> {
  const sess = await requireSession();
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing user." };
  if (id === sess.userId) return { ok: false, error: "You cannot delete your own account." };

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) return { ok: false, error: "User not found." };
  await requirePermission(resourceForRole(user.role), "delete");

  const [sessionCount, sentMsg, recvMsg] = await Promise.all([
    prisma.mentoringSession.count({ where: { mentorId: id } }),
    prisma.message.count({ where: { senderId: id } }),
    prisma.message.count({ where: { recipientId: id } }),
  ]);
  const msgCount = sentMsg + recvMsg;
  const blockers: string[] = [];
  if (sessionCount) blockers.push(`${sessionCount} mentoring session${sessionCount > 1 ? "s" : ""}`);
  if (msgCount) blockers.push(`${msgCount} message${msgCount > 1 ? "s" : ""}`);
  if (blockers.length) {
    return {
      ok: false,
      error: `Cannot delete — this account has ${blockers.join(" and ")} on record. Deactivate the account instead to preserve that history.`,
    };
  }

  try {
    await prisma.student.updateMany({ where: { mentorId: id }, data: { mentorId: null } });
    await prisma.user.delete({ where: { id } });
  } catch {
    return { ok: false, error: "Could not delete this account — please try again or contact support." };
  }
  await log("DELETE", "User", id, { name: user.name, role: user.role });
  touch("/admin/users", "/admin/mentors", "/admin/students", "/chief/mentors", "/supervisor/mentors");
  return { ok: true };
}

// ============================================================================
// INSTITUTIONS
// ============================================================================
export async function saveInstitution(fd: FormData): Promise<Result> {
  const id = sn(fd, "id");
  await requirePermission("institutions", id ? "edit" : "create");

  const parsed = institutionInputSchema.safeParse({ name: s(fd, "name"), contactEmail: sn(fd, "contactEmail") });
  if (!parsed.success) return { ok: false, error: zodFieldError(parsed) };

  const data = {
    name: parsed.data.name, type: s(fd, "type") as Prisma.InstitutionCreateInput["type"],
    city: sn(fd, "city"), address: sn(fd, "address"), contactName: sn(fd, "contactName"),
    contactPhone: sn(fd, "contactPhone"), contactEmail: parsed.data.contactEmail || null,
  };
  const res = id ? await prisma.institution.update({ where: { id }, data }) : await prisma.institution.create({ data });
  await log(id ? "UPDATE" : "CREATE", "Institution", res.id);
  touch("/admin/institutions");
  return { ok: true, id: res.id };
}

export async function deleteInstitution(fd: FormData): Promise<Result> {
  await requirePermission("institutions", "delete");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing institution." };
  const inst = await prisma.institution.findUnique({ where: { id }, select: { name: true } });
  if (!inst) return { ok: false, error: "Institution not found." };

  try {
    await prisma.institution.delete({ where: { id } });
  } catch {
    return { ok: false, error: "Could not delete this institution — please try again or contact support." };
  }
  await log("DELETE", "Institution", id, { name: inst.name });
  touch("/admin/institutions");
  return { ok: true };
}

// ============================================================================
// SESSIONS
// ============================================================================
export async function createSession(fd: FormData): Promise<Result> {
  const sess = await requirePermission("sessions", "create");
  const studentIds = fd.getAll("studentIds").map((x) => x.toString()).filter(Boolean);
  const session = await prisma.mentoringSession.create({
    data: {
      mentorId: sn(fd, "mentorId") || sess.userId,
      type: s(fd, "type") as Prisma.MentoringSessionCreateInput["type"],
      title: s(fd, "title") || "Mentoring Session",
      topic: sn(fd, "topic"), agenda: sn(fd, "agenda"),
      scheduledAt: date(fd, "scheduledAt") || new Date(),
      durationMins: num(fd, "durationMins") || 45,
      meetingLink: sn(fd, "meetingLink"), location: sn(fd, "location"),
      createdById: sess.userId,
      attendance: { create: studentIds.map((studentId) => ({ studentId })) },
    },
  });
  await log("CREATE", "MentoringSession", session.id);
  touch("/mentor/sessions", "/mentor", "/admin/sessions", "/supervisor/sessions");
  return { ok: true, id: session.id };
}

export async function completeSession(fd: FormData): Promise<Result> {
  await requirePermission("sessions", "edit");
  const id = s(fd, "id");
  await prisma.mentoringSession.update({
    where: { id },
    data: {
      status: "COMPLETED", observations: sn(fd, "observations"),
      actionPoints: sn(fd, "actionPoints"), parentNote: sn(fd, "parentNote"),
    },
  });
  // attendance updates: keys like att_<studentId>=PRESENT
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("att_")) {
      const studentId = k.slice(4);
      await prisma.sessionAttendance.updateMany({
        where: { sessionId: id, studentId }, data: { status: v.toString() as Prisma.SessionAttendanceUpdateInput["status"] },
      });
    }
  }
  const followUp = sn(fd, "followUp");
  if (followUp) {
    const sess = await prisma.mentoringSession.findUnique({ where: { id }, include: { attendance: true } });
    await prisma.task.create({
      data: { title: followUp, sessionId: id, studentId: sess?.attendance[0]?.studentId, status: "PENDING", createdById: (await getSession())!.userId },
    });
  }
  await log("COMPLETE", "MentoringSession", id);
  touch("/mentor/sessions", `/mentor/sessions/${id}`, "/mentor");
  return { ok: true };
}

export async function updateSession(fd: FormData): Promise<Result> {
  await requirePermission("sessions", "edit");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing session." };
  const title = s(fd, "title");
  if (!title) return { ok: false, error: "Title is required." };
  await prisma.mentoringSession.update({
    where: { id },
    data: {
      title, type: s(fd, "type") as Prisma.MentoringSessionUpdateInput["type"],
      topic: sn(fd, "topic"), agenda: sn(fd, "agenda"),
      scheduledAt: date(fd, "scheduledAt") || undefined,
      durationMins: num(fd, "durationMins") || 45,
      meetingLink: sn(fd, "meetingLink"), location: sn(fd, "location"),
    },
  });
  await log("UPDATE", "MentoringSession", id);
  touch("/mentor/sessions", `/mentor/sessions/${id}`, "/admin/sessions", "/supervisor/sessions");
  return { ok: true };
}

export async function deleteSession(fd: FormData): Promise<Result> {
  await requirePermission("sessions", "delete");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing session." };
  const session = await prisma.mentoringSession.findUnique({ where: { id }, select: { title: true } });
  if (!session) return { ok: false, error: "Session not found." };
  await prisma.mentoringSession.delete({ where: { id } });
  await log("DELETE", "MentoringSession", id, { title: session.title });
  touch("/mentor/sessions", "/admin/sessions", "/supervisor/sessions");
  return { ok: true };
}

// ============================================================================
// REPORTS
// ============================================================================
export async function createReport(fd: FormData): Promise<Result> {
  const sess = await requirePermission("reports", "create");
  const report = await prisma.progressReport.create({
    data: {
      studentId: s(fd, "studentId"), title: s(fd, "title") || "Progress Report",
      type: (s(fd, "type") || "MONTHLY") as Prisma.ProgressReportCreateInput["type"],
      period: sn(fd, "period"), summary: sn(fd, "summary"),
      content: {
        academic: num(fd, "academic") ?? 0, leadership: num(fd, "leadership") ?? 0,
        character: num(fd, "character") ?? 0, lifeSkills: num(fd, "lifeSkills") ?? 0,
        spiritual: num(fd, "spiritual") ?? 0,
      },
      status: s(fd, "status") === "DRAFT" ? "DRAFT" : "PENDING", submittedById: sess.userId,
    },
  });
  await log("CREATE", "ProgressReport", report.id);
  touch("/mentor/reports", "/supervisor/reports", "/admin/reports", "/mentor");
  return { ok: true, id: report.id };
}

export async function reviewReport(fd: FormData): Promise<Result> {
  const sess = await requirePermission("reports", "edit");
  const id = s(fd, "id");
  await prisma.progressReport.update({ where: { id }, data: { status: "REVIEWED", reviewedById: sess.userId } });
  await log("REVIEW", "ProgressReport", id);
  touch("/supervisor/reports", "/mentor/reports", "/admin/reports");
  return { ok: true };
}

export async function deleteReport(fd: FormData): Promise<Result> {
  await requirePermission("reports", "delete");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing report." };
  const report = await prisma.progressReport.findUnique({ where: { id }, select: { title: true } });
  if (!report) return { ok: false, error: "Report not found." };
  await prisma.progressReport.delete({ where: { id } });
  await log("DELETE", "ProgressReport", id, { title: report.title });
  touch("/supervisor/reports", "/mentor/reports", "/admin/reports", "/parent/reports");
  return { ok: true };
}

export async function shareReport(fd: FormData): Promise<Result> {
  await requirePermission("reports", "edit");
  const id = s(fd, "id");
  const report = await prisma.progressReport.update({
    where: { id }, data: { sharedWithParent: true, status: "PUBLISHED" },
    include: { student: { include: { parent: true } } },
  });
  if (report.student.parent)
    await notify(report.student.parent.id, "New progress report", `${report.student.fullName}'s ${report.period ?? ""} report is available.`, "/parent/reports");
  touch("/parent/reports", "/mentor/reports");
  return { ok: true };
}

// ============================================================================
// COMMUNICATION
// ============================================================================
export async function sendMessage(fd: FormData): Promise<Result> {
  const sess = await requirePermission("messages", "create");
  const recipientId = s(fd, "recipientId");
  if (!recipientId) return { ok: false, error: "Select a recipient" };
  const msg = await prisma.message.create({
    data: {
      senderId: sess.userId, recipientId, subject: sn(fd, "subject"),
      body: s(fd, "body"), relatedStudentId: sn(fd, "relatedStudentId"),
    },
  });
  await notify(recipientId, "New message", `${sess.name}: ${s(fd, "subject") || s(fd, "body").slice(0, 40)}`, "/");
  touch("/mentor/messages", "/parent/messages", "/supervisor/messages", "/admin/messages", "/chief/messages", "/student/messages");
  return { ok: true, id: msg.id };
}

export async function markMessageRead(fd: FormData): Promise<Result> {
  const sess = await requireSession();
  await prisma.message.updateMany({ where: { id: s(fd, "id"), recipientId: sess.userId }, data: { isRead: true } });
  return { ok: true };
}

// Deletes the message for both parties — this is a shared inbox row, not per-user soft delete.
// Only the sender or recipient may remove it.
export async function deleteMessage(fd: FormData): Promise<Result> {
  const sess = await requirePermission("messages", "delete");
  const id = s(fd, "id");
  const msg = await prisma.message.findUnique({ where: { id } });
  if (!msg) return { ok: false, error: "Message not found." };
  if (msg.senderId !== sess.userId && msg.recipientId !== sess.userId) {
    return { ok: false, error: "You can only delete your own messages." };
  }
  await prisma.message.delete({ where: { id } });
  touch("/admin/messages", "/mentor/messages", "/parent/messages", "/supervisor/messages", "/chief/messages", "/student/messages");
  return { ok: true };
}

export async function createAnnouncement(fd: FormData): Promise<Result> {
  const sess = await requirePermission("announcements", "create");
  const a = await prisma.announcement.create({
    data: {
      authorId: sess.userId, title: s(fd, "title"), body: s(fd, "body"),
      audience: (s(fd, "audience") || "ALL") as Prisma.AnnouncementCreateInput["audience"],
      pinned: fd.get("pinned") === "on",
    },
  });
  touch("/admin/announcements", "/chief/announcements", "/mentor", "/parent", "/student");
  return { ok: true, id: a.id };
}

export async function updateAnnouncement(fd: FormData): Promise<Result> {
  await requirePermission("announcements", "edit");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing announcement." };
  const title = s(fd, "title");
  const body = s(fd, "body");
  if (!title || !body) return { ok: false, error: "Title and message are required." };
  await prisma.announcement.update({
    where: { id },
    data: {
      title, body,
      audience: (s(fd, "audience") || "ALL") as Prisma.AnnouncementUpdateInput["audience"],
      pinned: fd.get("pinned") === "on",
    },
  });
  await log("UPDATE", "Announcement", id);
  touch("/admin/announcements", "/chief/announcements", "/mentor", "/parent", "/student");
  return { ok: true };
}

export async function deleteAnnouncement(fd: FormData): Promise<Result> {
  await requirePermission("announcements", "delete");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing announcement." };
  const a = await prisma.announcement.findUnique({ where: { id }, select: { title: true } });
  if (!a) return { ok: false, error: "Announcement not found." };
  await prisma.announcement.delete({ where: { id } });
  await log("DELETE", "Announcement", id, { title: a.title });
  touch("/admin/announcements", "/chief/announcements");
  return { ok: true };
}

// ============================================================================
// FEEDBACK
// ============================================================================
export async function submitFeedback(fd: FormData): Promise<Result> {
  const sess = await requirePermission("feedback", "create");
  const f = await prisma.feedback.create({
    data: {
      fromUserId: sess.userId, studentId: sn(fd, "studentId"), mentorId: sn(fd, "mentorId"),
      rating: num(fd, "rating"), comment: s(fd, "comment"),
    },
  });
  touch("/parent/feedback", "/supervisor/feedback", "/mentor");
  return { ok: true, id: f.id };
}

export async function markFeedbackReviewed(fd: FormData): Promise<Result> {
  await requirePermission("feedback", "edit");
  await prisma.feedback.update({ where: { id: s(fd, "id") }, data: { status: "REVIEWED" } });
  touch("/supervisor/feedback");
  return { ok: true };
}

// Feedback text is submitted by a parent/student and isn't editable by staff (that would let staff
// rewrite someone else's review) — only moderation-delete is offered here, not update.
export async function deleteFeedback(fd: FormData): Promise<Result> {
  await requirePermission("feedback", "delete");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing feedback." };
  const fb = await prisma.feedback.findUnique({ where: { id } });
  if (!fb) return { ok: false, error: "Feedback not found." };
  await prisma.feedback.delete({ where: { id } });
  await log("DELETE", "Feedback", id);
  touch("/supervisor/feedback", "/mentor", "/parent/feedback");
  return { ok: true };
}

// ============================================================================
// TASKS & GOALS
// ============================================================================
export async function createTask(fd: FormData): Promise<Result> {
  const sess = await requirePermission("portfolio", "create");
  const t = await prisma.task.create({
    data: {
      title: s(fd, "title"), description: sn(fd, "description"), studentId: sn(fd, "studentId"),
      assignedToId: sn(fd, "assignedToId"), dueDate: date(fd, "dueDate"), createdById: sess.userId,
    },
  });
  touch("/mentor/tasks", "/student/tasks", "/mentor");
  return { ok: true, id: t.id };
}

export async function toggleTask(fd: FormData): Promise<Result> {
  await requirePermission("portfolio", "edit");
  const id = s(fd, "id");
  const t = await prisma.task.findUnique({ where: { id } });
  await prisma.task.update({ where: { id }, data: { status: t?.status === "DONE" ? "PENDING" : "DONE" } });
  touch("/mentor/tasks", "/student/tasks");
  return { ok: true };
}

export async function updateTask(fd: FormData): Promise<Result> {
  await requirePermission("portfolio", "edit");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing task." };
  const title = s(fd, "title");
  if (!title) return { ok: false, error: "Title is required." };
  await prisma.task.update({
    where: { id },
    data: { title, description: sn(fd, "description"), dueDate: date(fd, "dueDate") },
  });
  touch("/mentor/tasks", "/student/tasks", "/admin/students");
  return { ok: true };
}

export async function deleteTask(fd: FormData): Promise<Result> {
  await requirePermission("portfolio", "delete");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing task." };
  const t = await prisma.task.findUnique({ where: { id } });
  if (!t) return { ok: false, error: "Task not found." };
  await prisma.task.delete({ where: { id } });
  touch("/mentor/tasks", "/student/tasks", "/admin/students");
  return { ok: true };
}

export async function createGoal(fd: FormData): Promise<Result> {
  const sess = await requirePermission("portfolio", "create");
  const g = await prisma.goal.create({
    data: {
      studentId: s(fd, "studentId"), title: s(fd, "title"), description: sn(fd, "description"),
      category: (sn(fd, "category") || null) as Prisma.GoalCreateInput["category"],
      targetDate: date(fd, "targetDate"), progress: num(fd, "progress") ?? 0, createdById: sess.userId,
      status: (num(fd, "progress") ?? 0) >= 100 ? "COMPLETED" : "IN_PROGRESS",
    },
  });
  touch("/student/goals", "/mentor", `/admin/students/${s(fd, "studentId")}`);
  return { ok: true, id: g.id };
}

export async function updateGoalProgress(fd: FormData): Promise<Result> {
  await requirePermission("portfolio", "edit");
  const id = s(fd, "id");
  const progress = num(fd, "progress") ?? 0;
  await prisma.goal.update({
    where: { id },
    data: { progress, status: progress >= 100 ? "COMPLETED" : progress > 0 ? "IN_PROGRESS" : "NOT_STARTED" },
  });
  touch("/student/goals", "/mentor");
  return { ok: true };
}

export async function updateGoal(fd: FormData): Promise<Result> {
  await requirePermission("portfolio", "edit");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing goal." };
  const title = s(fd, "title");
  if (!title) return { ok: false, error: "Title is required." };
  await prisma.goal.update({
    where: { id },
    data: {
      title, description: sn(fd, "description"),
      category: (sn(fd, "category") || null) as Prisma.GoalUpdateInput["category"],
      targetDate: date(fd, "targetDate"),
    },
  });
  touch("/student/goals", "/mentor", "/admin/students");
  return { ok: true };
}

export async function deleteGoal(fd: FormData): Promise<Result> {
  await requirePermission("portfolio", "delete");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing goal." };
  const g = await prisma.goal.findUnique({ where: { id } });
  if (!g) return { ok: false, error: "Goal not found." };
  await prisma.goal.delete({ where: { id } });
  touch("/student/goals", "/mentor", "/admin/students");
  return { ok: true };
}

// ============================================================================
// GROWTH / ACHIEVEMENTS / DOCUMENTS
// ============================================================================
export async function addGrowthRecord(fd: FormData): Promise<Result> {
  const sess = await requirePermission("portfolio", "create");
  await prisma.growthRecord.create({
    data: {
      studentId: s(fd, "studentId"), category: s(fd, "category") as Prisma.GrowthRecordCreateInput["category"],
      title: s(fd, "title"), note: sn(fd, "note"), score: num(fd, "score"), recordedById: sess.userId,
    },
  });
  touch(`/admin/students/${s(fd, "studentId")}`, "/mentor");
  return { ok: true };
}

export async function deleteGrowthRecord(fd: FormData): Promise<Result> {
  await requirePermission("portfolio", "delete");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing growth record." };
  const rec = await prisma.growthRecord.findUnique({ where: { id } });
  if (!rec) return { ok: false, error: "Growth record not found." };
  await prisma.growthRecord.delete({ where: { id } });
  touch(`/admin/students/${rec.studentId}`, "/mentor");
  return { ok: true };
}

export async function addAchievement(fd: FormData): Promise<Result> {
  const sess = await requirePermission("portfolio", "create");
  await prisma.achievement.create({
    data: { studentId: s(fd, "studentId"), title: s(fd, "title"), description: sn(fd, "description"), category: sn(fd, "category"), addedById: sess.userId },
  });
  touch("/student/achievements", `/admin/students/${s(fd, "studentId")}`);
  return { ok: true };
}

export async function updateAchievement(fd: FormData): Promise<Result> {
  await requirePermission("portfolio", "edit");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing achievement." };
  const title = s(fd, "title");
  if (!title) return { ok: false, error: "Title is required." };
  await prisma.achievement.update({
    where: { id }, data: { title, description: sn(fd, "description"), category: sn(fd, "category") },
  });
  touch("/student/achievements", "/admin/students");
  return { ok: true };
}

export async function deleteAchievement(fd: FormData): Promise<Result> {
  await requirePermission("portfolio", "delete");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing achievement." };
  const a = await prisma.achievement.findUnique({ where: { id } });
  if (!a) return { ok: false, error: "Achievement not found." };
  await prisma.achievement.delete({ where: { id } });
  touch("/student/achievements", "/admin/students");
  return { ok: true };
}

export async function addDocument(fd: FormData): Promise<Result> {
  const sess = await requirePermission("portfolio", "create");

  // Real file upload: if a file is attached, persist it to /public/uploads.
  let fileUrl = s(fd, "fileUrl");
  let fileName = sn(fd, "fileName");
  const file = fd.get("file");
  if (file && typeof file === "object" && "arrayBuffer" in file && (file as File).size > 0) {
    const f = file as File;
    if (f.size > 10 * 1024 * 1024) return { ok: false, error: "File too large (max 10MB)." };
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const stored = `${Date.now()}-${safe}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, stored), Buffer.from(await f.arrayBuffer()));
    fileUrl = `/uploads/${stored}`;
    fileName = f.name;
  }
  if (!fileUrl) return { ok: false, error: "Attach a file or provide a URL." };

  await prisma.studentDocument.create({
    data: {
      studentId: s(fd, "studentId"), type: (s(fd, "type") || "OTHER") as Prisma.StudentDocumentCreateInput["type"],
      title: s(fd, "title"), fileName, fileUrl, uploadedById: sess.userId,
    },
  });
  touch(`/admin/students/${s(fd, "studentId")}`, "/parent/documents", "/mentor");
  return { ok: true };
}

export async function updateDocument(fd: FormData): Promise<Result> {
  await requirePermission("portfolio", "edit");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing document." };
  const title = s(fd, "title");
  if (!title) return { ok: false, error: "Title is required." };
  await prisma.studentDocument.update({
    where: { id }, data: { title, type: (s(fd, "type") || "OTHER") as Prisma.StudentDocumentUpdateInput["type"] },
  });
  touch("/parent/documents", "/mentor", "/admin/students");
  return { ok: true };
}

export async function deleteDocument(fd: FormData): Promise<Result> {
  await requirePermission("portfolio", "delete");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing document." };
  const doc = await prisma.studentDocument.findUnique({ where: { id } });
  if (!doc) return { ok: false, error: "Document not found." };
  await prisma.studentDocument.delete({ where: { id } });
  if (doc.fileUrl.startsWith("/uploads/")) {
    await unlink(path.join(process.cwd(), "public", doc.fileUrl)).catch(() => {});
  }
  touch("/parent/documents", "/mentor", "/admin/students");
  return { ok: true };
}

// ============================================================================
// ASSESSMENTS
// ============================================================================
export async function saveAssessmentTemplate(fd: FormData): Promise<Result> {
  const id = sn(fd, "id");
  const sess = await requirePermission("assessments", id ? "edit" : "create");
  const title = s(fd, "title");
  if (!title) return { ok: false, error: "Title is required." };

  let questions: unknown;
  try {
    questions = JSON.parse(s(fd, "questions") || "[]");
    if (!Array.isArray(questions)) throw new Error();
  } catch {
    return { ok: false, error: "Questions must be valid JSON array — e.g. [{\"id\":\"q1\",\"text\":\"...\",\"options\":[...]}]." };
  }
  let scoring: unknown = null;
  const scoringRaw = s(fd, "scoring");
  if (scoringRaw) {
    try {
      scoring = JSON.parse(scoringRaw);
    } catch {
      return { ok: false, error: "Scoring must be valid JSON." };
    }
  }

  const data = {
    title, description: sn(fd, "description"),
    level: s(fd, "level") as Prisma.AssessmentTemplateCreateInput["level"],
    category: s(fd, "category") as Prisma.AssessmentTemplateCreateInput["category"],
    ageMin: num(fd, "ageMin"), ageMax: num(fd, "ageMax"), durationMins: num(fd, "durationMins"),
    questions: questions as Prisma.InputJsonValue,
    scoring: scoring as Prisma.InputJsonValue,
  };
  const res = id
    ? await prisma.assessmentTemplate.update({ where: { id }, data })
    : await prisma.assessmentTemplate.create({ data: { ...data, createdById: sess.userId } });
  await log(id ? "UPDATE" : "CREATE", "AssessmentTemplate", res.id);
  touch("/admin/assessments");
  return { ok: true, id: res.id };
}

export async function setTemplateActive(fd: FormData): Promise<Result> {
  await requirePermission("assessments", "edit");
  const id = s(fd, "id");
  await prisma.assessmentTemplate.update({ where: { id }, data: { isActive: s(fd, "isActive") === "true" } });
  touch("/admin/assessments");
  return { ok: true };
}

export async function deleteAssessmentTemplate(fd: FormData): Promise<Result> {
  await requirePermission("assessments", "delete");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing template." };
  const template = await prisma.assessmentTemplate.findUnique({
    where: { id }, select: { title: true, _count: { select: { instances: true } } },
  });
  if (!template) return { ok: false, error: "Template not found." };
  if (template._count.instances > 0) {
    return {
      ok: false,
      error: `Cannot delete — ${template._count.instances} student assessment(s) use this template. Mark it inactive instead to retire it without losing results.`,
    };
  }
  await prisma.assessmentTemplate.delete({ where: { id } });
  await log("DELETE", "AssessmentTemplate", id, { title: template.title });
  touch("/admin/assessments");
  return { ok: true };
}

export async function assignAssessment(fd: FormData): Promise<Result> {
  const sess = await requirePermission("assessments", "edit");
  const a = await prisma.studentAssessment.create({
    data: { studentId: s(fd, "studentId"), templateId: s(fd, "templateId"), assignedById: sess.userId },
  });
  touch("/mentor/assessments", "/student/assessments", "/admin/assessments");
  return { ok: true, id: a.id };
}

export async function submitAssessment(fd: FormData): Promise<Result> {
  await requirePermission("assessments", "edit");
  const id = s(fd, "id");
  const inst = await prisma.studentAssessment.findUnique({ where: { id }, include: { template: true } });
  if (!inst) return { ok: false, error: "Not found" };
  const questions = (inst.template.questions as { id: string; options: { value: number; score: number; trait?: string }[] }[]) || [];
  const answers: Record<string, number> = {};
  const traitScores: Record<string, { sum: number; count: number }> = {};
  let total = 0, max = 0;
  for (const q of questions) {
    const val = num(fd, `q_${q.id}`);
    if (val == null) continue;
    answers[q.id] = val;
    const opt = q.options.find((o) => o.value === val);
    const score = opt?.score ?? val;
    total += score;
    max += Math.max(...q.options.map((o) => o.score));
    const trait = opt?.trait;
    if (trait) {
      traitScores[trait] = traitScores[trait] || { sum: 0, count: 0 };
      traitScores[trait].sum += score;
      traitScores[trait].count += 1;
    }
  }
  const interpretation: Record<string, number> = {};
  for (const [t, v] of Object.entries(traitScores)) interpretation[t] = Math.round((v.sum / (v.count * 5)) * 100);
  const pct = max ? Math.round((total / max) * 100) : 0;
  await prisma.studentAssessment.update({
    where: { id },
    data: {
      status: "COMPLETED", answers, score: pct, maxScore: 100, interpretation,
      resultSummary: `Overall aptitude score ${pct}%. Strongest area: ${Object.entries(interpretation).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—"}.`,
      completedAt: new Date(),
    },
  });
  touch("/student/assessments", "/mentor/assessments", "/parent/assessments");
  return { ok: true, id };
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================
export async function markAllNotificationsRead(): Promise<Result> {
  const sess = await requireSession();
  await prisma.notification.updateMany({ where: { userId: sess.userId, isRead: false }, data: { isRead: true } });
  touch("/");
  return { ok: true };
}

// ============================================================================
// ACCOUNT — the signed-in user's own profile & password
// ============================================================================
export async function updateProfile(fd: FormData): Promise<Result> {
  const sess = await requireSession();
  const name = s(fd, "name");
  if (!name) return { ok: false, error: "Name is required." };

  // Optional avatar upload → /public/uploads (same pattern as documents).
  let avatar: string | undefined;
  const file = fd.get("avatar");
  if (file && typeof file === "object" && "arrayBuffer" in file && (file as File).size > 0) {
    const f = file as File;
    if (!f.type.startsWith("image/")) return { ok: false, error: "Profile photo must be an image." };
    if (f.size > 5 * 1024 * 1024) return { ok: false, error: "Image too large (max 5MB)." };
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const stored = `avatar-${sess.userId}-${Date.now()}-${safe}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, stored), Buffer.from(await f.arrayBuffer()));
    avatar = `/uploads/${stored}`;
  }

  const user = await prisma.user.update({
    where: { id: sess.userId },
    data: {
      name,
      phone: sn(fd, "phone"),
      title: sn(fd, "title"),
      bio: sn(fd, "bio"),
      ...(avatar ? { avatar } : {}),
    },
  });

  // Keep the session cookie in sync — name/avatar are embedded in the JWT.
  await createSessionCookie({
    userId: user.id, role: user.role, name: user.name, email: user.email, avatar: user.avatar,
  });
  await log("UPDATE", "User", user.id, { self: true });
  touch("/account", "/");
  return { ok: true };
}

export async function changePassword(fd: FormData): Promise<Result> {
  const sess = await requireSession();
  const current = s(fd, "currentPassword");
  const next = s(fd, "newPassword");
  const confirm = s(fd, "confirmPassword");
  if (!current || !next) return { ok: false, error: "Fill in all password fields." };
  if (next.length < 8) return { ok: false, error: "New password must be at least 8 characters." };
  if (next !== confirm) return { ok: false, error: "New passwords do not match." };

  const user = await prisma.user.findUnique({ where: { id: sess.userId } });
  if (!user) return { ok: false, error: "User not found." };
  if (!(await verifyPassword(current, user.passwordHash)))
    return { ok: false, error: "Current password is incorrect." };

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next) } });
  await log("PASSWORD_CHANGE", "User", user.id, { self: true });
  return { ok: true };
}

// ============================================================================
// MENTOR RECRUITMENT — public application → interview → resource pool
// ============================================================================
export async function submitMentorApplication(fd: FormData): Promise<Result> {
  const name = s(fd, "name");
  const email = s(fd, "email");
  if (!name || !email) return { ok: false, error: "Name and email are required." };

  // optional CV file upload
  let cvFileUrl = sn(fd, "cvFileUrl");
  const file = fd.get("cvFile");
  if (file && typeof file === "object" && "arrayBuffer" in file && (file as File).size > 0) {
    const f = file as File;
    if (f.size > 10 * 1024 * 1024) return { ok: false, error: "CV file too large (max 10MB)." };
    const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const stored = `cv-${Date.now()}-${safe}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, stored), Buffer.from(await f.arrayBuffer()));
    cvFileUrl = `/uploads/${stored}`;
  }

  const app = await prisma.mentorApplication.create({
    data: {
      name, email: email.toLowerCase(), phone: sn(fd, "phone"),
      qualifications: sn(fd, "qualifications"), experience: sn(fd, "experience"), cv: sn(fd, "cv"), cvFileUrl,
      preferredMode: (sn(fd, "preferredMode") || null) as Prisma.MentorApplicationCreateInput["preferredMode"],
      languages: sn(fd, "languages"), timezone: sn(fd, "timezone"), city: sn(fd, "city"), exposure: sn(fd, "exposure"),
    },
  });
  const admins = await prisma.user.findMany({ where: { role: "SUPER_ADMIN" }, select: { id: true } });
  for (const a of admins)
    await notify(a.id, "New mentor application", `${name} applied to become a mentor.`, "/admin/mentor-applications");
  touch("/admin/mentor-applications", "/admin");
  return { ok: true, id: app.id };
}

export async function moveMentorToInterview(fd: FormData): Promise<Result> {
  const sess = await requirePermission("mentor_applications", "edit");
  const id = s(fd, "id");
  await prisma.mentorApplication.update({
    where: { id }, data: { status: "INTERVIEW", interviewNote: sn(fd, "interviewNote"), reviewedById: sess.userId },
  });
  await log("INTERVIEW", "MentorApplication", id);
  touch("/admin/mentor-applications");
  return { ok: true };
}

export async function approveMentorApplication(fd: FormData): Promise<Result> {
  const sess = await requirePermission("mentor_applications", "edit");
  const id = s(fd, "id");
  const app = await prisma.mentorApplication.findUnique({ where: { id } });
  if (!app) return { ok: false, error: "Application not found" };

  // create or promote the mentor user → add to the resource pool
  let user = await prisma.user.findUnique({ where: { email: app.email.toLowerCase() } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: app.name, email: app.email.toLowerCase(), passwordHash: await hashPassword("Elevate@123"),
        role: "MENTOR", phone: app.phone, bio: app.experience,
        mentoringMode: app.preferredMode, city: app.city, timezone: app.timezone,
        languages: app.languages, exposure: app.exposure, availableForPool: true,
      },
    });
  } else {
    await prisma.user.update({ where: { id: user.id }, data: { availableForPool: true } });
  }
  await prisma.mentorApplication.update({
    where: { id }, data: { status: "APPROVED", reviewedById: sess.userId, createdUserId: user.id },
  });
  await notify(user.id, "Welcome to the mentor pool", "Your mentor application has been approved.", "/mentor");
  await log("APPROVE", "MentorApplication", id);
  touch("/admin/mentor-applications", "/admin/mentors", "/admin/users", "/admin");
  return { ok: true, id: user.id };
}

export async function rejectMentorApplication(fd: FormData): Promise<Result> {
  const sess = await requirePermission("mentor_applications", "edit");
  const id = s(fd, "id");
  await prisma.mentorApplication.update({
    where: { id }, data: { status: "REJECTED", interviewNote: sn(fd, "interviewNote"), reviewedById: sess.userId },
  });
  await log("REJECT", "MentorApplication", id);
  touch("/admin/mentor-applications");
  return { ok: true };
}

export async function deleteMentorApplication(fd: FormData): Promise<Result> {
  await requirePermission("mentor_applications", "delete");
  const id = s(fd, "id");
  if (!id) return { ok: false, error: "Missing application." };
  const app = await prisma.mentorApplication.findUnique({ where: { id }, select: { name: true } });
  if (!app) return { ok: false, error: "Application not found." };
  await prisma.mentorApplication.delete({ where: { id } });
  await log("DELETE", "MentorApplication", id, { name: app.name });
  touch("/admin/mentor-applications");
  return { ok: true };
}

// ============================================================================
// MONTHLY MEETUP UPDATE — mentor logs how the mentee changed this month
// ============================================================================
export async function addMonthlyUpdate(fd: FormData): Promise<Result> {
  const sess = await requirePermission("portfolio", "create");
  const studentId = s(fd, "studentId");
  if (!studentId) return { ok: false, error: "Missing student." };
  const summary = s(fd, "summary");
  if (!summary) return { ok: false, error: "Please describe how the mentee changed this month." };

  const student = await prisma.student.findUnique({
    where: { id: studentId }, select: { mentorId: true, parentId: true, fullName: true },
  });
  await prisma.monthlyUpdate.create({
    data: {
      studentId, mentorId: student?.mentorId ?? sess.userId,
      month: s(fd, "month") || new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" }),
      summary, progress: num(fd, "progress"), createdById: sess.userId,
    },
  });
  if (student?.parentId)
    await notify(student.parentId, "New monthly update", `A monthly mentoring update was added for ${student.fullName}.`, "/parent");
  await log("CREATE", "MonthlyUpdate", studentId);
  touch(`/admin/students/${studentId}`, `/mentor/mentees/${studentId}`, "/mentor");
  return { ok: true };
}

// ============================================================================
// MENTOR ASSIGNMENT (matching) — assign a mentor to a student
// ============================================================================
export async function assignMentor(fd: FormData): Promise<Result> {
  await requirePermission("students", "edit");
  const studentId = s(fd, "studentId");
  const mentorId = sn(fd, "mentorId");
  if (!studentId) return { ok: false, error: "Missing student." };
  await prisma.student.update({ where: { id: studentId }, data: { mentorId } });
  await log("ASSIGN_MENTOR", "Student", studentId, { mentorId });
  touch(`/admin/students/${studentId}`, "/admin/students", "/mentor/mentees");
  return { ok: true };
}

// ============================================================================
// RBAC — Roles & Responsibilities (Super Admin only)
// ============================================================================
export async function saveAppRole(fd: FormData): Promise<Result> {
  await requireSuperAdmin();
  const id = sn(fd, "id");
  const name = s(fd, "name");
  if (!name) return { ok: false, error: "Role name is required." };

  const dupe = await prisma.appRole.findUnique({ where: { name } });
  if (dupe && dupe.id !== id) return { ok: false, error: "A role with this name already exists." };

  if (id) {
    const existing = await prisma.appRole.findUnique({ where: { id } });
    if (!existing) return { ok: false, error: "Role not found." };
    if (existing.isSystem) return { ok: false, error: "System roles cannot be renamed." };
    await prisma.appRole.update({
      where: { id },
      data: { name, baseRole: s(fd, "baseRole") as Prisma.AppRoleUpdateInput["baseRole"] },
    });
    await log("UPDATE", "AppRole", id, { name });
    touch("/admin/roles");
    return { ok: true, id };
  }

  const baseRole = s(fd, "baseRole") as Role;
  const role = await prisma.appRole.create({
    data: {
      name, baseRole, isSystem: false,
      // start the matrix from the base role's defaults so it's editable from a sane baseline
      permissions: {
        create: RESOURCES.map((r) => ({
          resource: r.key,
          canCreate: DEFAULT_MATRIX[baseRole][r.key].create,
          canView: DEFAULT_MATRIX[baseRole][r.key].view,
          canEdit: DEFAULT_MATRIX[baseRole][r.key].edit,
          canDelete: DEFAULT_MATRIX[baseRole][r.key].delete,
        })),
      },
    },
  });
  await log("CREATE", "AppRole", role.id, { name, baseRole });
  touch("/admin/roles");
  return { ok: true, id: role.id };
}

export async function deleteAppRole(fd: FormData): Promise<Result> {
  await requireSuperAdmin();
  const id = s(fd, "id");
  const role = await prisma.appRole.findUnique({
    where: { id }, include: { _count: { select: { users: true } } },
  });
  if (!role) return { ok: false, error: "Role not found." };
  if (role.isSystem) return { ok: false, error: "System roles cannot be deleted." };
  await prisma.appRole.delete({ where: { id } }); // users fall back to their system role (appRoleId → null)
  await log("DELETE", "AppRole", id, { name: role.name, usersDetached: role._count.users });
  touch("/admin/roles", "/admin/users");
  return { ok: true };
}

export async function saveRolePermissions(fd: FormData): Promise<Result> {
  await requireSuperAdmin();
  const roleId = s(fd, "roleId");
  const role = await prisma.appRole.findUnique({ where: { id: roleId } });
  if (!role) return { ok: false, error: "Role not found." };
  if (role.isSystem && role.baseRole === "SUPER_ADMIN") {
    return { ok: false, error: "Super Admin permissions are locked and cannot be edited." };
  }

  for (const r of RESOURCES) {
    const data = {
      canCreate: fd.get(`${r.key}.create`) === "on",
      canView: fd.get(`${r.key}.view`) === "on",
      canEdit: fd.get(`${r.key}.edit`) === "on",
      canDelete: fd.get(`${r.key}.delete`) === "on",
    };
    await prisma.rolePermission.upsert({
      where: { roleId_resource: { roleId, resource: r.key } },
      create: { roleId, resource: r.key, ...data },
      update: data,
    });
  }
  await log("UPDATE", "RolePermissions", roleId, { role: role.name });
  touch("/admin/roles");
  return { ok: true };
}

export async function assignUserRole(fd: FormData): Promise<Result> {
  const sess = await requireSuperAdmin();
  const userId = s(fd, "userId");
  const appRoleId = sn(fd, "appRoleId");
  if (!userId) return { ok: false, error: "Missing user." };
  if (userId === sess.userId) return { ok: false, error: "You cannot change your own permission role (lockout protection)." };
  if (appRoleId && !(await prisma.appRole.findUnique({ where: { id: appRoleId } }))) {
    return { ok: false, error: "Selected role does not exist." };
  }
  await prisma.user.update({ where: { id: userId }, data: { appRoleId } });
  await log("ASSIGN_ROLE", "User", userId, { appRoleId });
  touch("/admin/users", "/admin/roles");
  return { ok: true };
}
