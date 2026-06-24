# Elevate U Portal — Builder Context (READ FULLY BEFORE CODING)

Full-stack **Next.js 15 (App Router) + TypeScript + Prisma(MySQL) + Tailwind**. Mentoring management portal for SLEP (NDHR Global). The foundation, DB schema, auth, shared UI, charts, and ALL server-side mutation actions already exist. Your job: build **page files only**, composing the existing pieces with **real Prisma data**.

## HARD RULES
- Only create files inside the folders you are assigned. Do NOT edit `package.json`, `prisma/`, `src/lib/`, `src/middleware.ts`, `src/components/**` (read them for reference only), or another agent's folder.
- Do NOT run a dev server, build, `npm install`, or `prisma` commands. A dev server is already running. No new dependencies — only use installed: `recharts`, `lucide-react`, `clsx`, `zod` (already wrapped by components).
- Every page is a **server component**: `export default async function Page(...)`. Query Prisma directly.
- **Next 15: `params` and `searchParams` are Promises.** Always: `export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; tab?: string }> }) { const { id } = await params; const { q } = await searchParams; ... }`
- Forms that mutate: use `<ActionForm action={someServerAction}>` + `<SubmitButton>`. For create/edit dialogs wrap in `<Modal>`. Inputs use class `input`, labels `label`, or `<Field label>`. Selects/inputs need a matching `name` attribute matching the action's expected FormData keys (below).
- Scope data by role using the session (below). e.g. a Mentor page shows only that mentor's mentees.
- Match the visual language of the mockups (navy sidebar already done; cards are white rounded-2xl with soft shadow; brand colors below). Keep pages clean, data-dense, responsive (`grid gap-4 sm:grid-cols-2 lg:grid-cols-3` patterns).

## BRAND COLORS
navy `#0E2A5E`, brand-blue `#1E50A2`, green/leaf `#2FA84F`, gold `#E0A92E`, teal `#14A1A8`, purple `#6d28d9`. Tailwind tokens available: `text-navy bg-navy text-leaf bg-leaf text-gold bg-gold`. Buttons: classes `btn-primary` (navy), `btn-green`, `btn-gold`, `btn-outline`, `btn-ghost`.

## SESSION (auth)
```ts
import { getSession } from "@/lib/auth";
const session = await getSession(); // { userId, role, name, email, avatar }
```
Layout already guards auth + renders sidebar/topbar. Roles: `SUPER_ADMIN | CHIEF_MENTOR | SUPERVISOR | MENTOR | PARENT | STUDENT`.
Reporting chain on User: `managerId` (mentor.managerId = supervisor.id; supervisor.managerId = chief.id). Use it to scope: a supervisor's mentors = `user.findMany({ where: { managerId: session.userId, role: 'MENTOR' } })`; their students = students whose mentor is in that set.

## PRISMA (import { prisma } from "@/lib/db")
Models (key fields):
- **User**: id, name, email, role, status(ACTIVE|INACTIVE|PENDING), phone?, avatar?, title?, institutionId?, managerId?, lastLogin?, createdAt. Relations: institution, manager, reports[], studentsAsMentor[], studentsAsParent[].
- **Institution**: id, name, type(SCHOOL|MAHALL|COLLEGE|NDHR_CLIENT|OTHER), code?, city?, address?, contactName/Phone/Email?, isActive.
- **Student**: id, fullName, gender?, dob?, ageCategory(LEVEL_1|LEVEL_2|LEVEL_3)?, email?, phone?, address?, photo?, className?, rollNo?, interests?, talents?, notes?, status(PENDING|ACTIVE|INACTIVE|GRADUATED), admissionDate, institutionId?, parentId?, mentorId?, userId?(student login). Relations: institution, parent(User), mentor(User), documents[], growthRecords[], goals[], tasks[], assessments[], attendance[], reports[], achievements[], feedback[].
- **ParentApplication**: id, parentName, parentEmail, parentPhone, studentName, studentDob?, studentGender?, institutionName?, className?, message?, status(PENDING|APPROVED|REJECTED), reviewNote?, createdAt.
- **StudentDocument**: id, studentId, type(PHOTO|ID_PROOF|MARKSHEET|CONSENT_FORM|CERTIFICATE|SESSION_NOTE|ASSESSMENT_REPORT|OTHER), title, fileName?, fileUrl, createdAt, uploadedBy(User).
- **GrowthRecord**: id, studentId, category(ACADEMIC|PERSONALITY|LIFE_SKILLS|MORAL_VALUE|HEALTH_WELLBEING|CAREER), title, note?, score?(0-100), date, recordedBy(User).
- **Goal**: id, studentId, title, description?, category(GrowthCategory)?, targetDate?, progress(0-100), status(NOT_STARTED|IN_PROGRESS|COMPLETED).
- **Task**: id, title, description?, studentId?, assignedToId?, dueDate?, status(PENDING|IN_PROGRESS|DONE), priority?, sessionId?, createdById.
- **AssessmentTemplate**: id, title, description?, level(LEVEL_1|LEVEL_2|LEVEL_3|GENERAL), category(SELF_DISCOVERY|TALENT_DISCOVERY|CAREER_APTITUDE|MULTIPLE_INTELLIGENCE|LEARNING_STYLE|PERSONALITY|STRENGTH|LEADERSHIP), ageMin?, ageMax?, durationMins?, questions(Json array: {id,text,type,options:[{label,value,score,trait}]}), isActive. Relation: instances[].
- **StudentAssessment**: id, studentId, templateId, status(ASSIGNED|IN_PROGRESS|COMPLETED), answers(Json)?, score?, maxScore?, resultSummary?, interpretation(Json: {trait:number})?, recommendations?, completedAt?, createdAt. Relations: student, template, assignedBy.
- **MentoringSession**: id, mentorId, type(ONLINE|OFFLINE|REVIEW), title, topic?, agenda?, scheduledAt, durationMins?, meetingLink?, location?, status(SCHEDULED|COMPLETED|CANCELLED|MISSED), observations?, actionPoints?, parentNote?. Relations: mentor(User), attendance[](SessionAttendance{student,status}), tasks[].
- **SessionAttendance**: id, sessionId, studentId, status(PRESENT|ABSENT|LATE|EXCUSED), note?. Relation: student.
- **Message**: id, senderId, recipientId, subject?, body, isRead, relatedStudentId?, createdAt. Relations: sender, recipient.
- **Announcement**: id, authorId?, title, body, audience(ALL|MENTORS|SUPERVISORS|CHIEF_MENTORS|PARENTS|STUDENTS|INSTITUTION), pinned, createdAt. Relation: author.
- **Feedback**: id, fromUserId?, studentId?, mentorId?, rating?(1-5), comment, status(NEW|REVIEWED), createdAt. Relations: fromUser, student, mentor.
- **ProgressReport**: id, studentId, title, type(MONTHLY|QUARTERLY|ANNUAL|ASSESSMENT|SESSION), period?, summary?, content(Json {academic,leadership,character,lifeSkills,spiritual})?, fileUrl?, status(DRAFT|PENDING|REVIEWED|PUBLISHED), submittedById?, reviewedById?, sharedWithParent. Relations: student, submittedBy, reviewedBy.
- **Achievement**: id, studentId, title, description?, category?, date, addedBy.
- **Notification**: id, userId, title, message, type?, link?, isRead, createdAt.
- **AuditLog**: id, userId?, action, entity?, entityId?, createdAt, user.

## SERVER ACTIONS (import from "@/lib/actions") — all `(fd: FormData) => Promise<{ok,error?,id?}>`
Form field `name`s expected:
- `submitApplication`: parentName, parentEmail, parentPhone, studentName, studentGender?, studentDob?, institutionName?, className?, message?  (PUBLIC, no auth)
- `approveApplication`: id, mentorId?, institutionId?  | `rejectApplication`: id, reviewNote?
- `saveStudent`: id?(edit), fullName, gender?, dob?, email?, phone?, className?, address?, interests?, talents?, institutionId?, mentorId?, parentId?
- `saveUser`: id?, name, email, role, phone?, title?, institutionId?, managerId?, password?  | `setUserStatus`: id, status
- `saveInstitution`: id?, name, type, city?, address?, contactName?, contactPhone?, contactEmail?
- `createSession`: mentorId?(defaults to current user), type, title, topic?, agenda?, scheduledAt(datetime-local), durationMins?, meetingLink?, location?, studentIds(multiple) | `completeSession`: id, observations?, actionPoints?, parentNote?, followUp?, and per-attendee `att_<studentId>` = PRESENT|ABSENT|LATE|EXCUSED
- `createReport`: studentId, title, type, period?, summary?, academic, leadership, character, lifeSkills, spiritual, status?(DRAFT to save draft else PENDING) | `reviewReport`: id | `shareReport`: id
- `sendMessage`: recipientId, subject?, body, relatedStudentId? | `markMessageRead`: id
- `createAnnouncement`: title, body, audience?, pinned?(checkbox name=pinned)
- `submitFeedback`: studentId?, mentorId?, rating?, comment | `markFeedbackReviewed`: id
- `createTask`: title, description?, studentId?, assignedToId?, dueDate? | `toggleTask`: id
- `createGoal`: studentId, title, description?, category?, targetDate?, progress? | `updateGoalProgress`: id, progress
- `addGrowthRecord`: studentId, category, title, note?, score? | `addAchievement`: studentId, title, description?, category?
- `addDocument`: studentId, type, title, fileName?, fileUrl?
- `assignAssessment`: studentId, templateId | `submitAssessment`: id, and per-question `q_<questionId>` = numeric value
- `markAllNotificationsRead`: ()

## COMPONENT API (import paths exact)
`@/components/ui/primitives`:
- `Card({className,children})`, `CardHeader({title,subtitle?,action?})`
- `StatCard({label, value, delta?, icon?, tint?})` — icon is a lucide `<Icon className="h-5 w-5"/>`
- `Badge({tone, children})` tone: green|blue|gold|red|slate|purple|teal
- `Progress({value, color?})`
- `Avatar({name, src?, size?, tint?})`
- `EmptyState({title, hint?, icon?})`
- `PageHeader({title, subtitle?, action?})`

`@/components/ui/StatusBadge`: `StatusBadge({status})` — auto-colors any enum string.
`@/components/dash/widgets`:
- `Panel({title?, action?, children, className?, bodyClassName?})` — white card with header bar
- `MiniMetric({label, value, sub?})`, `ActivityItem({title, meta?, time?, dot?})`
- `QuickAction({href, label, tone?})`, `AlertRow({text, href?, tone?})` tone amber|red|blue
- `trendSeries(target:number, months?)` -> [{name,value}] gently rising series
`@/components/ui/charts` (client; use directly in server pages as JSX):
- `TrendLineChart({data:[{name, ...keys}], series:[{key,label,color?}], height?})`
- `DonutChart({data:[{name,value,color?}], centerLabel?, height?})`
- `SkillRadarChart({data:[{axis, ...keys}], series:[{key,label,color?}], height?})`
- `GroupBarChart({data:[{name, ...keys}], series:[{key,label,color?}], height?})`
- exported `CHART_COLORS` array
`@/components/ui/DataTable`: `DataTable<T>({columns:[{header, cell:(row)=>node, className?}], rows, empty?, getKey:(row,i)=>string})`
`@/components/ui/Modal`: `Modal({trigger:(open)=>node, title, children:(close)=>node, wide?})` — e.g. `<Modal title="Add" trigger={(open)=><button onClick={open} className="btn-primary">Add</button>}>{(close)=><ActionForm action={x} onDone={close}>...</ActionForm>}</Modal>`
`@/components/ui/ActionForm`: `ActionForm({action, children, onDone?, className?, resetOnSuccess?})`
`@/components/ui/form`: `SubmitButton({children, className?, pendingText?})`, `Field({label, children, hint?})`
`@/components/ui/SearchBar`: `SearchBar({placeholder?, param?})` (writes ?q=) — filter rows server-side by `q`.
`@/components/ui/Tabs`: `TabLinks({tabs:[{key,label}], param?})` (writes ?tab=) — read tab from awaited searchParams.
`@/lib/utils`: `cn, initials, ageFromDob(dob), ageCategory(age), CATEGORY_LABEL, fmtDate, fmtDateTime, timeAgo, titleCase`.

## PATTERNS
List page:
```tsx
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { DataTable } from "@/components/ui/DataTable";
import { SearchBar } from "@/components/ui/SearchBar";
export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  const rows = await prisma.student.findMany({ where: q ? { fullName: { contains: q } } : {}, include: { mentor: true } });
  return (<><PageHeader title="Students" action={<SearchBar placeholder="Search students"/>} />
    <Panel><DataTable rows={rows} getKey={(r)=>r.id} columns={[{header:"Name", cell:(r)=>r.fullName}, ...]} /></Panel></>);
}
```
Always `getKey` returns a stable string. Cells return JSX. Use `Avatar`, `StatusBadge`, `Progress`, `fmtDate`, links (`<Link href={...}>`) inside cells.

Keep each page focused and production-looking. Prefer real aggregates (counts, groupBy, averages). When a metric isn't in DB, derive from related rows (don't hardcode fake big numbers except small illustrative deltas like "+8% from last month").
