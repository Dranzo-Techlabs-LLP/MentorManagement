"use server";

import { revalidatePath } from "next/cache";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "./db";
import { getSession, hashPassword, verifyPassword, createSessionCookie } from "./auth";
import { requireSession, requireRole } from "./guard";
import { ageFromDob, ageCategory } from "./utils";
import type { Prisma, AgeCategory } from "@prisma/client";

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
  await requireRole("SUPER_ADMIN", "CHIEF_MENTOR");
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
  await requireRole("SUPER_ADMIN", "CHIEF_MENTOR");
  const id = s(fd, "id");
  await prisma.parentApplication.update({
    where: { id }, data: { status: "REJECTED", reviewNote: sn(fd, "reviewNote"), reviewedById: (await getSession())!.userId },
  });
  await log("REJECT", "ParentApplication", id);
  touch("/admin/applications");
  return { ok: true };
}

// ============================================================================
// STUDENTS
// ============================================================================
export async function saveStudent(fd: FormData): Promise<Result> {
  await requireRole("SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR");
  const id = sn(fd, "id");
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

// SWOC analysis — mentor/staff create or update a mentee's SWOC (one per student).
export async function upsertSwoc(fd: FormData): Promise<Result> {
  const sess = await requireRole("MENTOR", "SUPERVISOR", "CHIEF_MENTOR", "SUPER_ADMIN");
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
  await requireRole("SUPER_ADMIN");
  const id = sn(fd, "id");
  const email = s(fd, "email").toLowerCase();
  const base = {
    name: s(fd, "name"), email, role: s(fd, "role") as Prisma.UserCreateInput["role"],
    phone: sn(fd, "phone"), title: sn(fd, "title"), institutionId: sn(fd, "institutionId"),
    managerId: sn(fd, "managerId"),
    // mentor profile & matching
    mentoringMode: (sn(fd, "mentoringMode") || null) as Prisma.UserCreateInput["mentoringMode"],
    city: sn(fd, "city"), timezone: sn(fd, "timezone"), languages: sn(fd, "languages"),
    exposure: sn(fd, "exposure"), yearsExperience: num(fd, "yearsExperience"),
  };
  if (id) {
    await prisma.user.update({ where: { id }, data: base });
    touch("/admin/users", "/admin/mentors");
    return { ok: true, id };
  }
  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) return { ok: false, error: "Email already in use" };
  const pwd = s(fd, "password") || "Elevate@123";
  const user = await prisma.user.create({ data: { ...base, passwordHash: await hashPassword(pwd) } });
  await log("CREATE", "User", user.id, { role: base.role });
  touch("/admin/users", "/admin/mentors");
  return { ok: true, id: user.id };
}

export async function setUserStatus(fd: FormData): Promise<Result> {
  await requireRole("SUPER_ADMIN");
  const id = s(fd, "id");
  await prisma.user.update({ where: { id }, data: { status: s(fd, "status") as Prisma.UserUpdateInput["status"] } });
  touch("/admin/users");
  return { ok: true };
}

// ============================================================================
// INSTITUTIONS
// ============================================================================
export async function saveInstitution(fd: FormData): Promise<Result> {
  await requireRole("SUPER_ADMIN");
  const id = sn(fd, "id");
  const data = {
    name: s(fd, "name"), type: s(fd, "type") as Prisma.InstitutionCreateInput["type"],
    city: sn(fd, "city"), address: sn(fd, "address"), contactName: sn(fd, "contactName"),
    contactPhone: sn(fd, "contactPhone"), contactEmail: sn(fd, "contactEmail"),
  };
  const res = id ? await prisma.institution.update({ where: { id }, data }) : await prisma.institution.create({ data });
  touch("/admin/institutions");
  return { ok: true, id: res.id };
}

// ============================================================================
// SESSIONS
// ============================================================================
export async function createSession(fd: FormData): Promise<Result> {
  const sess = await requireRole("MENTOR", "SUPERVISOR", "CHIEF_MENTOR", "SUPER_ADMIN");
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
  await requireRole("MENTOR", "SUPERVISOR", "CHIEF_MENTOR", "SUPER_ADMIN");
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

// ============================================================================
// REPORTS
// ============================================================================
export async function createReport(fd: FormData): Promise<Result> {
  const sess = await requireRole("MENTOR", "SUPERVISOR", "CHIEF_MENTOR", "SUPER_ADMIN");
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
  const sess = await requireRole("SUPERVISOR", "CHIEF_MENTOR", "SUPER_ADMIN");
  const id = s(fd, "id");
  await prisma.progressReport.update({ where: { id }, data: { status: "REVIEWED", reviewedById: sess.userId } });
  await log("REVIEW", "ProgressReport", id);
  touch("/supervisor/reports", "/mentor/reports", "/admin/reports");
  return { ok: true };
}

export async function shareReport(fd: FormData): Promise<Result> {
  await requireRole("MENTOR", "SUPERVISOR", "CHIEF_MENTOR", "SUPER_ADMIN");
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
  const sess = await requireSession();
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

export async function createAnnouncement(fd: FormData): Promise<Result> {
  const sess = await requireRole("SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR");
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

// ============================================================================
// FEEDBACK
// ============================================================================
export async function submitFeedback(fd: FormData): Promise<Result> {
  const sess = await requireSession();
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
  await requireRole("SUPERVISOR", "CHIEF_MENTOR", "SUPER_ADMIN", "MENTOR");
  await prisma.feedback.update({ where: { id: s(fd, "id") }, data: { status: "REVIEWED" } });
  touch("/supervisor/feedback");
  return { ok: true };
}

// ============================================================================
// TASKS & GOALS
// ============================================================================
export async function createTask(fd: FormData): Promise<Result> {
  const sess = await requireSession();
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
  await requireSession();
  const id = s(fd, "id");
  const t = await prisma.task.findUnique({ where: { id } });
  await prisma.task.update({ where: { id }, data: { status: t?.status === "DONE" ? "PENDING" : "DONE" } });
  touch("/mentor/tasks", "/student/tasks");
  return { ok: true };
}

export async function createGoal(fd: FormData): Promise<Result> {
  const sess = await requireSession();
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
  await requireSession();
  const id = s(fd, "id");
  const progress = num(fd, "progress") ?? 0;
  await prisma.goal.update({
    where: { id },
    data: { progress, status: progress >= 100 ? "COMPLETED" : progress > 0 ? "IN_PROGRESS" : "NOT_STARTED" },
  });
  touch("/student/goals", "/mentor");
  return { ok: true };
}

// ============================================================================
// GROWTH / ACHIEVEMENTS / DOCUMENTS
// ============================================================================
export async function addGrowthRecord(fd: FormData): Promise<Result> {
  const sess = await requireRole("MENTOR", "SUPERVISOR", "CHIEF_MENTOR", "SUPER_ADMIN");
  await prisma.growthRecord.create({
    data: {
      studentId: s(fd, "studentId"), category: s(fd, "category") as Prisma.GrowthRecordCreateInput["category"],
      title: s(fd, "title"), note: sn(fd, "note"), score: num(fd, "score"), recordedById: sess.userId,
    },
  });
  touch(`/admin/students/${s(fd, "studentId")}`, "/mentor");
  return { ok: true };
}

export async function addAchievement(fd: FormData): Promise<Result> {
  const sess = await requireRole("MENTOR", "SUPERVISOR", "CHIEF_MENTOR", "SUPER_ADMIN");
  await prisma.achievement.create({
    data: { studentId: s(fd, "studentId"), title: s(fd, "title"), description: sn(fd, "description"), category: sn(fd, "category"), addedById: sess.userId },
  });
  touch("/student/achievements", `/admin/students/${s(fd, "studentId")}`);
  return { ok: true };
}

export async function addDocument(fd: FormData): Promise<Result> {
  const sess = await requireSession();

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

// ============================================================================
// ASSESSMENTS
// ============================================================================
export async function assignAssessment(fd: FormData): Promise<Result> {
  const sess = await requireRole("MENTOR", "SUPERVISOR", "CHIEF_MENTOR", "SUPER_ADMIN");
  const a = await prisma.studentAssessment.create({
    data: { studentId: s(fd, "studentId"), templateId: s(fd, "templateId"), assignedById: sess.userId },
  });
  touch("/mentor/assessments", "/student/assessments", "/admin/assessments");
  return { ok: true, id: a.id };
}

export async function submitAssessment(fd: FormData): Promise<Result> {
  await requireSession();
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
  const sess = await requireRole("SUPER_ADMIN", "CHIEF_MENTOR");
  const id = s(fd, "id");
  await prisma.mentorApplication.update({
    where: { id }, data: { status: "INTERVIEW", interviewNote: sn(fd, "interviewNote"), reviewedById: sess.userId },
  });
  await log("INTERVIEW", "MentorApplication", id);
  touch("/admin/mentor-applications");
  return { ok: true };
}

export async function approveMentorApplication(fd: FormData): Promise<Result> {
  const sess = await requireRole("SUPER_ADMIN", "CHIEF_MENTOR");
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
  const sess = await requireRole("SUPER_ADMIN", "CHIEF_MENTOR");
  const id = s(fd, "id");
  await prisma.mentorApplication.update({
    where: { id }, data: { status: "REJECTED", interviewNote: sn(fd, "interviewNote"), reviewedById: sess.userId },
  });
  await log("REJECT", "MentorApplication", id);
  touch("/admin/mentor-applications");
  return { ok: true };
}

// ============================================================================
// MONTHLY MEETUP UPDATE — mentor logs how the mentee changed this month
// ============================================================================
export async function addMonthlyUpdate(fd: FormData): Promise<Result> {
  const sess = await requireRole("MENTOR", "SUPERVISOR", "CHIEF_MENTOR", "SUPER_ADMIN");
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
  await requireRole("SUPER_ADMIN", "CHIEF_MENTOR", "SUPERVISOR");
  const studentId = s(fd, "studentId");
  const mentorId = sn(fd, "mentorId");
  if (!studentId) return { ok: false, error: "Missing student." };
  await prisma.student.update({ where: { id: studentId }, data: { mentorId } });
  await log("ASSIGN_MENTOR", "Student", studentId, { mentorId });
  touch(`/admin/students/${studentId}`, "/admin/students", "/mentor/mentees");
  return { ok: true };
}
