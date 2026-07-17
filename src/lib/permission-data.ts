import type { Role } from "@prisma/client";

/** RBAC data — pure constants, safe to import from both the app and prisma/seed.ts. */

export const OPS = ["create", "view", "edit", "delete"] as const;
export type Op = (typeof OPS)[number];
export type PermSet = Record<Op, boolean>;

export const RESOURCES = [
  { key: "students", label: "Students" },
  { key: "portfolio", label: "Student Portfolio (goals, tasks, records, docs)" },
  { key: "mentors", label: "Mentors" },
  { key: "parents", label: "Parents" },
  { key: "users", label: "Users Management (staff)" },
  { key: "institutions", label: "Institutions" },
  { key: "applications", label: "Parent Applications" },
  { key: "mentor_applications", label: "Mentor Applications" },
  { key: "sessions", label: "Mentoring Sessions" },
  { key: "assessments", label: "Assessments" },
  { key: "reports", label: "Progress Reports" },
  { key: "announcements", label: "Announcements" },
  { key: "messages", label: "Messages" },
  { key: "feedback", label: "Feedback" },
  { key: "logs", label: "System Logs" },
  { key: "settings", label: "Settings & Roles" },
] as const;

export type ResourceKey = (typeof RESOURCES)[number]["key"];

const p = (create: boolean, view: boolean, edit: boolean, del: boolean): PermSet => ({
  create, view, edit, delete: del,
});
const NONE = p(false, false, false, false);
const VIEW = p(false, true, false, false);
const ALL = p(true, true, true, true);

/**
 * Default permission matrix per workspace role — mirrors the access rules the
 * app shipped with. Used to seed system roles and as the fallback when a role
 * has no explicit rows for a resource.
 */
export const DEFAULT_MATRIX: Record<Role, Record<ResourceKey, PermSet>> = {
  SUPER_ADMIN: {
    students: ALL, portfolio: ALL, mentors: ALL, parents: ALL, users: ALL,
    institutions: ALL, applications: ALL, mentor_applications: ALL, sessions: ALL,
    assessments: ALL, reports: ALL, announcements: ALL, messages: ALL,
    feedback: ALL, logs: p(false, true, false, false), settings: ALL,
  },
  CHIEF_MENTOR: {
    students: p(true, true, true, false), portfolio: ALL, mentors: VIEW, parents: VIEW,
    users: NONE, institutions: VIEW,
    applications: p(false, true, true, true), mentor_applications: p(false, true, true, true),
    sessions: ALL, assessments: p(true, true, true, false), reports: ALL,
    announcements: ALL, messages: p(true, true, false, true), feedback: p(false, true, true, true),
    logs: NONE, settings: NONE,
  },
  SUPERVISOR: {
    students: p(true, true, true, false), portfolio: ALL, mentors: VIEW, parents: VIEW,
    users: NONE, institutions: VIEW, applications: NONE, mentor_applications: NONE,
    sessions: ALL, assessments: p(false, true, true, false), reports: ALL,
    announcements: p(true, true, true, false), messages: p(true, true, false, true),
    feedback: p(false, true, true, true), logs: NONE, settings: NONE,
  },
  MENTOR: {
    students: VIEW, portfolio: ALL, mentors: NONE, parents: NONE, users: NONE,
    institutions: NONE, applications: NONE, mentor_applications: NONE,
    sessions: p(true, true, true, false), assessments: p(false, true, true, false),
    reports: p(true, true, false, false), announcements: VIEW,
    messages: p(true, true, false, true), feedback: p(false, true, true, false),
    logs: NONE, settings: NONE,
  },
  PARENT: {
    students: VIEW, portfolio: VIEW, mentors: NONE, parents: NONE, users: NONE,
    institutions: NONE, applications: NONE, mentor_applications: NONE, sessions: NONE,
    assessments: VIEW, reports: VIEW, announcements: VIEW,
    messages: p(true, true, false, true), feedback: p(true, true, false, false),
    logs: NONE, settings: NONE,
  },
  STUDENT: {
    students: NONE, portfolio: p(true, true, true, false), mentors: NONE, parents: NONE,
    users: NONE, institutions: NONE, applications: NONE, mentor_applications: NONE,
    sessions: NONE, assessments: p(false, true, true, false), reports: NONE,
    announcements: VIEW, messages: p(true, true, false, true), feedback: NONE,
    logs: NONE, settings: NONE,
  },
};

export const SYSTEM_ROLE_NAMES: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  CHIEF_MENTOR: "Chief Mentor",
  SUPERVISOR: "Supervisor",
  MENTOR: "Mentor",
  PARENT: "Parent",
  STUDENT: "Student",
};

/** Which permission resource governs managing a user of a given workspace role. */
export function resourceForRole(role: Role): ResourceKey {
  if (role === "MENTOR") return "mentors";
  if (role === "PARENT") return "parents";
  return "users";
}

/** Sidebar href → the resource whose `view` permission controls its visibility. */
export const NAV_RESOURCE: Record<string, ResourceKey> = {
  "/admin/users": "users",
  "/admin/mentors": "mentors",
  "/admin/students": "students",
  "/admin/parents": "parents",
  "/admin/applications": "applications",
  "/admin/mentor-applications": "mentor_applications",
  "/admin/institutions": "institutions",
  "/admin/assessments": "assessments",
  "/admin/sessions": "sessions",
  "/admin/reports": "reports",
  "/admin/messages": "messages",
  "/admin/announcements": "announcements",
  "/admin/logs": "logs",
  "/admin/settings": "settings",
  "/admin/roles": "settings",
  "/chief/supervisors": "users",
  "/chief/mentors": "mentors",
  "/chief/students": "students",
  "/chief/assessments": "assessments",
  "/chief/reports": "reports",
  "/chief/announcements": "announcements",
  "/chief/messages": "messages",
  "/supervisor/mentors": "mentors",
  "/supervisor/students": "students",
  "/supervisor/reports": "reports",
  "/supervisor/assessments": "assessments",
  "/supervisor/sessions": "sessions",
  "/supervisor/feedback": "feedback",
  "/supervisor/messages": "messages",
  "/mentor/mentees": "students",
  "/mentor/sessions": "sessions",
  "/mentor/reports": "reports",
  "/mentor/tasks": "portfolio",
  "/mentor/assessments": "assessments",
  "/mentor/messages": "messages",
  "/parent/children": "students",
  "/parent/reports": "reports",
  "/parent/assessments": "assessments",
  "/parent/feedback": "feedback",
  "/parent/messages": "messages",
  "/parent/documents": "portfolio",
  "/student/goals": "portfolio",
  "/student/tasks": "portfolio",
  "/student/assessments": "assessments",
  "/student/achievements": "portfolio",
  "/student/messages": "messages",
};
