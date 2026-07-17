import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { RESOURCES, DEFAULT_MATRIX, SYSTEM_ROLE_NAMES } from "../src/lib/permission-data";

const prisma = new PrismaClient();
const PASS = "Elevate@123";

function daysAgo(n: number) {
  return new Date(Date.now() - n * 86400000);
}
function daysAhead(n: number) {
  return new Date(Date.now() + n * 86400000);
}

async function main() {
  console.log("Seeding Elevate U portal...");
  const hash = await bcrypt.hash(PASS, 10);

  // wipe (order matters for FKs)
  await prisma.rolePermission.deleteMany();
  await prisma.appRole.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.achievement.deleteMany();
  await prisma.progressReport.deleteMany();
  await prisma.feedback.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.message.deleteMany();
  await prisma.sessionAttendance.deleteMany();
  await prisma.task.deleteMany();
  await prisma.mentoringSession.deleteMany();
  await prisma.studentAssessment.deleteMany();
  await prisma.assessmentTemplate.deleteMany();
  await prisma.goal.deleteMany();
  await prisma.growthRecord.deleteMany();
  await prisma.studentDocument.deleteMany();
  await prisma.parentApplication.deleteMany();
  await prisma.student.deleteMany();
  await prisma.user.deleteMany();
  await prisma.institution.deleteMany();

  // ---- Institutions ----
  const greenwood = await prisma.institution.create({
    data: { name: "Greenwood Public School", type: "SCHOOL", code: "GPS01", city: "Kozhikode", contactName: "Office", contactPhone: "+91 9876500001" },
  });
  const valleyMahall = await prisma.institution.create({
    data: { name: "Valley Mahall", type: "MAHALL", code: "VM02", city: "Malappuram", contactName: "Secretary", contactPhone: "+91 9876500002" },
  });

  const u = (
    name: string,
    email: string,
    role: Role,
    extra: Record<string, unknown> = {},
  ) =>
    prisma.user.create({
      data: { name, email: email.toLowerCase(), passwordHash: hash, role, ...extra },
    });

  // ---- Staff hierarchy ----
  const admin = await u("NDHR Super Admin", "superadmin@ndhrglobal.com", "SUPER_ADMIN", { title: "Administrator" });
  const chief = await u("Dr. Abdul Rahman", "chief@ndhrglobal.com", "CHIEF_MENTOR", { title: "Chief Mentor", institutionId: greenwood.id });
  const sup1 = await u("Dr. Farhan Jaleel", "supervisor@ndhrglobal.com", "SUPERVISOR", { title: "Mentoring Supervisor", institutionId: greenwood.id, managerId: chief.id });
  const sup2 = await u("Hafsa Marin", "supervisor2@ndhrglobal.com", "SUPERVISOR", { title: "Mentoring Supervisor", institutionId: valleyMahall.id, managerId: chief.id });

  const mentorAnsil = await u("Ansil Ahamed", "mentor@ndhrglobal.com", "MENTOR", { title: "Mentor", institutionId: greenwood.id, managerId: sup1.id });
  const mentorNazeera = await u("Fathima Nazeera", "nazeera@ndhrglobal.com", "MENTOR", { title: "Mentor", institutionId: greenwood.id, managerId: sup1.id });
  const mentorShameer = await u("Shameer P", "shameer@ndhrglobal.com", "MENTOR", { title: "Mentor", institutionId: valleyMahall.id, managerId: sup2.id });
  const mentorSafna = await u("Safna Noushad", "safna@ndhrglobal.com", "MENTOR", { title: "Mentor", institutionId: valleyMahall.id, managerId: sup2.id });

  // ---- Parents ----
  const parentRasheeda = await u("Rasheeda Beevi", "parent@ndhrglobal.com", "PARENT", { phone: "+91 9847012345" });
  const parentAbida = await u("Abida Yoosuf", "abida@ndhrglobal.com", "PARENT", { phone: "+91 9847012346" });
  const parentNoushad = await u("Noushad K", "noushad@ndhrglobal.com", "PARENT", { phone: "+91 9847012347" });

  const GROWTH_CATS = ["ACADEMIC", "PERSONALITY", "LIFE_SKILLS", "MORAL_VALUE", "HEALTH_WELLBEING", "CAREER"] as const;

  // ---- Students ----
  type SInput = {
    fullName: string; gender: string; age: number; className: string;
    parent: string; mentor: string; institution: string; status?: any; login?: string;
    interests: string; talents: string;
  };
  const studentDefs: SInput[] = [
    { fullName: "Muhammed Sinan", gender: "Male", age: 14, className: "Grade 9", parent: parentRasheeda.id, mentor: mentorAnsil.id, institution: greenwood.id, login: "student@ndhrglobal.com", interests: "Robotics, Football, Reading", talents: "Public speaking, Coding" },
    { fullName: "Fathima Rifa", gender: "Female", age: 13, className: "Grade 8", parent: parentRasheeda.id, mentor: mentorAnsil.id, institution: greenwood.id, interests: "Art, Poetry", talents: "Painting, Writing" },
    { fullName: "Ibrahim Faris", gender: "Male", age: 15, className: "Grade 10", parent: parentAbida.id, mentor: mentorAnsil.id, institution: greenwood.id, interests: "Science, Chess", talents: "Problem solving" },
    { fullName: "Aamina Najiha", gender: "Female", age: 11, className: "Grade 7", parent: parentAbida.id, mentor: mentorAnsil.id, institution: greenwood.id, interests: "Music, Dance", talents: "Singing" },
    { fullName: "Hana Maryam", gender: "Female", age: 12, className: "Grade 7", parent: parentNoushad.id, mentor: mentorNazeera.id, institution: greenwood.id, interests: "Reading, Debate", talents: "Leadership" },
    { fullName: "Yusuf Anas", gender: "Male", age: 16, className: "Grade 11", parent: parentNoushad.id, mentor: mentorNazeera.id, institution: greenwood.id, interests: "Entrepreneurship", talents: "Maths, Strategy" },
    { fullName: "Sara Thasni", gender: "Female", age: 17, className: "Grade 12", parent: parentAbida.id, mentor: mentorShameer.id, institution: valleyMahall.id, interests: "Biology, Volunteering", talents: "Empathy, Science" },
    { fullName: "Adnan Riyas", gender: "Male", age: 13, className: "Grade 8", parent: parentNoushad.id, mentor: mentorShameer.id, institution: valleyMahall.id, interests: "Cricket, History", talents: "Memory, Sports" },
    { fullName: "Liya Fathima", gender: "Female", age: 10, className: "Grade 5", parent: parentRasheeda.id, mentor: mentorSafna.id, institution: valleyMahall.id, interests: "Drawing, Stories", talents: "Creativity" },
    { fullName: "Rayan Mohammed", gender: "Male", age: 18, className: "Grade 12", parent: parentAbida.id, mentor: mentorSafna.id, institution: valleyMahall.id, interests: "Engineering, Coding", talents: "Logic, Build things" },
  ];

  function catFor(age: number) {
    if (age <= 12) return "LEVEL_1";
    if (age <= 15) return "LEVEL_2";
    return "LEVEL_3";
  }

  const students = [];
  for (const s of studentDefs) {
    let loginUserId: string | undefined;
    if (s.login) {
      const su = await u(s.fullName, s.login, "STUDENT");
      loginUserId = su.id;
    }
    const dob = new Date(); dob.setFullYear(dob.getFullYear() - s.age);
    const student = await prisma.student.create({
      data: {
        fullName: s.fullName, gender: s.gender, dob, ageCategory: catFor(s.age) as any,
        className: s.className, parentId: s.parent, mentorId: s.mentor, institutionId: s.institution,
        interests: s.interests, talents: s.talents, status: "ACTIVE", userId: loginUserId,
        rollNo: "EU" + Math.floor(1000 + Math.random() * 9000),
      },
    });
    students.push(student);

    // growth records across categories
    for (const cat of GROWTH_CATS) {
      await prisma.growthRecord.create({
        data: {
          studentId: student.id, category: cat as any,
          title: `${cat.replace(/_/g, " ")} review`,
          note: "Steady improvement observed over the mentoring period.",
          score: 55 + Math.floor(Math.random() * 40),
          recordedById: s.mentor, date: daysAgo(Math.floor(Math.random() * 40)),
        },
      });
    }
    // goals
    await prisma.goal.createMany({
      data: [
        { studentId: student.id, title: "Improve public speaking confidence", category: "PERSONALITY", progress: 60, status: "IN_PROGRESS", createdById: s.mentor, targetDate: daysAhead(30) },
        { studentId: student.id, title: "Complete leadership reading module", category: "LIFE_SKILLS", progress: 35, status: "IN_PROGRESS", createdById: s.mentor, targetDate: daysAhead(20) },
        { studentId: student.id, title: "Maintain academic consistency", category: "ACADEMIC", progress: 80, status: "IN_PROGRESS", createdById: s.mentor, targetDate: daysAhead(45) },
      ],
    });
    // achievements
    await prisma.achievement.createMany({
      data: [
        { studentId: student.id, title: "Completed Leadership Quiz", category: "Leadership", date: daysAgo(26), addedById: s.mentor },
        { studentId: student.id, title: "Active in Team Project", category: "Teamwork", date: daysAgo(15), addedById: s.mentor },
      ],
    });
    // tasks
    await prisma.task.createMany({
      data: [
        { title: "Complete Reflection Journal", studentId: student.id, assignedToId: loginUserId, dueDate: daysAhead(4), status: "PENDING", createdById: s.mentor },
        { title: "Read Leadership Module", studentId: student.id, assignedToId: loginUserId, dueDate: daysAhead(8), status: "PENDING", createdById: s.mentor },
      ],
    });
    // documents
    await prisma.studentDocument.create({
      data: { studentId: student.id, type: "CONSENT_FORM", title: "Parent Consent Form", fileUrl: "/uploads/consent-" + student.id + ".pdf", uploadedById: s.mentor },
    });
  }

  // ---- Assessment templates ----
  const sampleQs = (traits: string[]) =>
    Array.from({ length: 6 }).map((_, i) => ({
      id: `q${i + 1}`,
      text: `Statement ${i + 1}: I enjoy activities related to ${traits[i % traits.length]}.`,
      type: "scale",
      options: [
        { label: "Strongly Disagree", value: 1, score: 1, trait: traits[i % traits.length] },
        { label: "Disagree", value: 2, score: 2, trait: traits[i % traits.length] },
        { label: "Neutral", value: 3, score: 3, trait: traits[i % traits.length] },
        { label: "Agree", value: 4, score: 4, trait: traits[i % traits.length] },
        { label: "Strongly Agree", value: 5, score: 5, trait: traits[i % traits.length] },
      ],
    }));

  const tplSelf = await prisma.assessmentTemplate.create({
    data: { title: "Self Discovery Assessment", description: "Understand interests, strengths and learning style.", level: "LEVEL_1", category: "SELF_DISCOVERY", ageMin: 10, ageMax: 12, durationMins: 25, questions: sampleQs(["Curiosity", "Creativity", "Teamwork", "Discipline"]) as any, createdById: admin.id },
  });
  const tplTalent = await prisma.assessmentTemplate.create({
    data: { title: "Talent Discovery Assessment", description: "Identify natural talents and dominant intelligences.", level: "LEVEL_2", category: "TALENT_DISCOVERY", ageMin: 13, ageMax: 15, durationMins: 30, questions: sampleQs(["Logical", "Verbal", "Spatial", "Interpersonal"]) as any, createdById: admin.id },
  });
  const tplCareer = await prisma.assessmentTemplate.create({
    data: { title: "Career Aptitude Assessment", description: "Map aptitudes and interests to career pathways.", level: "LEVEL_3", category: "CAREER_APTITUDE", ageMin: 16, ageMax: 18, durationMins: 40, questions: sampleQs(["Analytical", "Social", "Enterprising", "Investigative"]) as any, createdById: admin.id },
  });
  const tplMI = await prisma.assessmentTemplate.create({
    data: { title: "Multiple Intelligence Assessment", description: "Discover dominant intelligences.", level: "GENERAL", category: "MULTIPLE_INTELLIGENCE", ageMin: 10, ageMax: 18, durationMins: 35, questions: sampleQs(["Linguistic", "Logical", "Musical", "Kinesthetic", "Interpersonal", "Intrapersonal"]) as any, createdById: admin.id },
  });
  await prisma.assessmentTemplate.create({
    data: { title: "Learning Style Assessment", description: "Understand how you learn best.", level: "GENERAL", category: "LEARNING_STYLE", ageMin: 10, ageMax: 18, durationMins: 20, questions: sampleQs(["Visual", "Auditory", "Reading", "Kinesthetic"]) as any, createdById: admin.id },
  });
  await prisma.assessmentTemplate.create({
    data: { title: "Leadership Potential Assessment", description: "Measure leadership skills and potential.", level: "GENERAL", category: "LEADERSHIP", ageMin: 13, ageMax: 18, durationMins: 25, questions: sampleQs(["Initiative", "Communication", "Responsibility", "Vision"]) as any, createdById: admin.id },
  });

  // assign + complete some assessments
  const traitsMI = ["Linguistic", "Logical", "Musical", "Kinesthetic", "Interpersonal", "Intrapersonal"];
  for (const st of students.slice(0, 6)) {
    const tpl = st.ageCategory === "LEVEL_1" ? tplSelf : st.ageCategory === "LEVEL_2" ? tplTalent : tplCareer;
    await prisma.studentAssessment.create({
      data: {
        studentId: st.id, templateId: tpl.id, status: "COMPLETED", score: 70 + Math.floor(Math.random() * 25), maxScore: 100,
        resultSummary: "Shows strong curiosity and collaborative tendencies. Recommended to nurture leadership and creative pursuits.",
        interpretation: traitsMI.reduce((a, t) => ({ ...a, [t]: 50 + Math.floor(Math.random() * 50) }), {}) as any,
        recommendations: "Encourage participation in debate club and project-based learning.",
        assignedById: st.mentorId!, completedAt: daysAgo(Math.floor(Math.random() * 20)),
      },
    });
    await prisma.studentAssessment.create({
      data: { studentId: st.id, templateId: tplMI.id, status: "ASSIGNED", assignedById: st.mentorId! },
    });
  }

  // ---- Sessions ----
  const mentors = [mentorAnsil, mentorNazeera, mentorShameer, mentorSafna];
  for (const m of mentors) {
    const mentees = students.filter((s) => s.mentorId === m.id);
    if (mentees.length === 0) continue;
    // past completed sessions
    for (let i = 0; i < 4; i++) {
      const sess = await prisma.mentoringSession.create({
        data: {
          mentorId: m.id, type: i % 3 === 0 ? "OFFLINE" : "ONLINE",
          title: i % 3 === 0 ? "Monthly Mentor–Mentee Meet" : "Weekly Online Mentoring",
          topic: ["Goal setting", "Time management", "Confidence building", "Academic planning"][i],
          scheduledAt: daysAgo((i + 1) * 7), status: "COMPLETED",
          observations: "Engaged well, completed previous action points. Positive attitude.",
          actionPoints: "Practice daily journaling; prepare a short presentation for next session.",
          parentNote: "Kindly support reading time at home.",
          createdById: m.id,
          meetingLink: i % 3 === 0 ? null : "https://meet.elevateu.example/" + m.id.slice(0, 6),
        },
      });
      await prisma.sessionAttendance.createMany({
        data: mentees.map((s) => ({ sessionId: sess.id, studentId: s.id, status: Math.random() > 0.15 ? "PRESENT" : "ABSENT" as any })),
      });
    }
    // upcoming scheduled
    for (let i = 0; i < 3; i++) {
      const sess = await prisma.mentoringSession.create({
        data: {
          mentorId: m.id, type: "ONLINE", title: "Weekly Online Mentoring",
          topic: ["Leadership skills", "Career awareness", "Personality development"][i],
          scheduledAt: daysAhead(i + 1), status: "SCHEDULED", createdById: m.id,
          meetingLink: "https://meet.elevateu.example/" + m.id.slice(0, 6),
        },
      });
      await prisma.sessionAttendance.createMany({
        data: mentees.slice(0, 1).map((s) => ({ sessionId: sess.id, studentId: s.id })),
      });
    }
  }

  // ---- Progress reports ----
  for (const st of students) {
    await prisma.progressReport.create({
      data: {
        studentId: st.id, title: `Monthly Progress — ${st.fullName}`, type: "MONTHLY", period: "May 2026",
        summary: "Consistent participation in mentoring sessions with measurable growth in confidence and academics.",
        content: { academic: 78, leadership: 65, character: 80, lifeSkills: 70, spiritual: 72 } as any,
        status: st === students[0] ? "PENDING" : "REVIEWED", submittedById: st.mentorId!, reviewedById: st === students[0] ? null : sup1.id,
        sharedWithParent: st !== students[0],
      },
    });
  }

  // ---- Messages ----
  await prisma.message.createMany({
    data: [
      { senderId: mentorAnsil.id, recipientId: parentRasheeda.id, subject: "Sinan's monthly update", body: "Sinan has shown great improvement in communication this month. Please encourage his reading habit.", relatedStudentId: students[0].id, createdAt: daysAgo(2) },
      { senderId: parentRasheeda.id, recipientId: mentorAnsil.id, subject: "Re: Sinan's monthly update", body: "Thank you for the update. We will support him at home.", createdAt: daysAgo(1) },
      { senderId: sup1.id, recipientId: mentorAnsil.id, subject: "Report review", body: "Please complete the pending monthly report for Sinan.", createdAt: daysAgo(1) },
      { senderId: admin.id, recipientId: sup1.id, subject: "Quarterly review meeting", body: "Quarterly supervisor review scheduled next week.", createdAt: daysAgo(3) },
    ],
  });

  // ---- Announcements ----
  await prisma.announcement.createMany({
    data: [
      { authorId: admin.id, title: "Leadership Workshop — June 18", body: "All mentees of Level 2 & 3 are invited to the leadership workshop on 18 June 2026, 10:00 AM.", audience: "ALL", pinned: true },
      { authorId: chief.id, title: "Monthly reporting deadline", body: "Mentors please submit monthly progress reports before the 1st of each month.", audience: "MENTORS" },
      { authorId: admin.id, title: "Parent–Mentor Meeting", body: "Parent–Mentor meetings scheduled for 10 June 2026, 6:00 PM.", audience: "PARENTS" },
    ],
  });

  // ---- Feedback ----
  await prisma.feedback.createMany({
    data: [
      { fromUserId: parentRasheeda.id, studentId: students[0].id, mentorId: mentorAnsil.id, rating: 5, comment: "Very happy with the mentoring support. Sinan is more confident now.", status: "NEW" },
      { fromUserId: parentAbida.id, studentId: students[2].id, mentorId: mentorAnsil.id, rating: 4, comment: "Good progress. Would appreciate more frequent updates.", status: "REVIEWED" },
    ],
  });

  // ---- Parent applications (pending onboarding) ----
  await prisma.parentApplication.createMany({
    data: [
      { parentName: "Salma Beevi", parentEmail: "salma@example.com", parentPhone: "+91 9847099001", studentName: "Arif Rahman", studentGender: "Male", institutionName: "Greenwood Public School", className: "Grade 9", message: "Interested in the SLEP mentoring program for my son.", status: "PENDING" },
      { parentName: "Jameela K", parentEmail: "jameela@example.com", parentPhone: "+91 9847099002", studentName: "Nida Fathima", studentGender: "Female", institutionName: "Valley Mahall", className: "Grade 7", message: "Please consider our application.", status: "PENDING" },
    ],
  });

  // ---- Notifications ----
  await prisma.notification.createMany({
    data: [
      { userId: admin.id, title: "5 mentor reports pending review", message: "There are reports awaiting supervisor review.", type: "warning", link: "/admin/reports" },
      { userId: admin.id, title: "3 students need attention", message: "Low activity detected for 3 students.", type: "alert", link: "/admin/students" },
      { userId: mentorAnsil.id, title: "Report pending", message: "Monthly report for Muhammed Sinan is pending submission.", type: "warning", link: "/mentor/reports" },
      { userId: mentorAnsil.id, title: "Upcoming session", message: "Weekly online mentoring with Muhammed Sinan today.", type: "info", link: "/mentor/sessions" },
      { userId: parentRasheeda.id, title: "New report available", message: "Fathima Rifa's monthly progress report is ready.", type: "info", link: "/parent/reports" },
      { userId: sup1.id, title: "Reports to review", message: "1 report submitted by Ansil Ahamed needs your review.", type: "warning", link: "/supervisor/reports" },
    ],
  });

  // RBAC — seed the six system permission roles with their default matrices.
  for (const [role, name] of Object.entries(SYSTEM_ROLE_NAMES) as [Role, string][]) {
    await prisma.appRole.create({
      data: {
        name, baseRole: role, isSystem: true,
        permissions: {
          create: RESOURCES.map((r) => ({
            resource: r.key,
            canCreate: DEFAULT_MATRIX[role][r.key].create,
            canView: DEFAULT_MATRIX[role][r.key].view,
            canEdit: DEFAULT_MATRIX[role][r.key].edit,
            canDelete: DEFAULT_MATRIX[role][r.key].delete,
          })),
        },
      },
    });
  }
  console.log("RBAC: seeded 6 system permission roles.");

  console.log(`Seed complete: ${students.length} students, ${mentors.length} mentors.`);
  console.log(`Login with any demo account · password: ${PASS}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
