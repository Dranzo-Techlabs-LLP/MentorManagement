import type { Role } from "@prisma/client";

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super Admin",
  CHIEF_MENTOR: "Chief Mentor",
  SUPERVISOR: "Supervisor",
  MENTOR: "Mentor",
  PARENT: "Parent",
  STUDENT: "Student",
};

export const ROLE_HOME: Record<Role, string> = {
  SUPER_ADMIN: "/admin",
  CHIEF_MENTOR: "/chief",
  SUPERVISOR: "/supervisor",
  MENTOR: "/mentor",
  PARENT: "/parent",
  STUDENT: "/student",
};

// theme accent per role (matches mockup chips)
export const ROLE_THEME: Record<Role, string> = {
  SUPER_ADMIN: "#0E2A5E",
  CHIEF_MENTOR: "#14A1A8",
  SUPERVISOR: "#E0A92E",
  MENTOR: "#1f7637",
  PARENT: "#6d28d9",
  STUDENT: "#1E50A2",
};

// Where the global top-bar search sends its query (a list page that supports ?q=).
// Roles without a searchable list (parent, student) are omitted → search box is hidden.
export const SEARCH_TARGET: Partial<Record<Role, string>> = {
  SUPER_ADMIN: "/admin/students",
  CHIEF_MENTOR: "/chief/students",
  SUPERVISOR: "/supervisor/students",
  MENTOR: "/mentor/mentees",
};

export type NavItem = { label: string; href: string; icon: string };

export const NAV: Record<Role, NavItem[]> = {
  SUPER_ADMIN: [
    { label: "Dashboard", href: "/admin", icon: "LayoutDashboard" },
    { label: "Users Management", href: "/admin/users", icon: "Users" },
    { label: "Mentors", href: "/admin/mentors", icon: "GraduationCap" },
    { label: "Students", href: "/admin/students", icon: "UserRound" },
    { label: "Parents", href: "/admin/parents", icon: "Contact" },
    { label: "Applications", href: "/admin/applications", icon: "ClipboardList" },
    { label: "Mentor Applications", href: "/admin/mentor-applications", icon: "UserCheck" },
    { label: "Institutions", href: "/admin/institutions", icon: "Building2" },
    { label: "Assessments", href: "/admin/assessments", icon: "FileBarChart" },
    { label: "Sessions", href: "/admin/sessions", icon: "CalendarDays" },
    { label: "Reports", href: "/admin/reports", icon: "FileText" },
    { label: "Communication", href: "/admin/messages", icon: "MessageSquare" },
    { label: "Announcements", href: "/admin/announcements", icon: "Megaphone" },
    { label: "System Logs", href: "/admin/logs", icon: "ScrollText" },
    { label: "Settings", href: "/admin/settings", icon: "Settings" },
  ],
  CHIEF_MENTOR: [
    { label: "Dashboard", href: "/chief", icon: "LayoutDashboard" },
    { label: "Supervisors", href: "/chief/supervisors", icon: "Users" },
    { label: "Mentors", href: "/chief/mentors", icon: "GraduationCap" },
    { label: "Students", href: "/chief/students", icon: "UserRound" },
    { label: "Assessments", href: "/chief/assessments", icon: "FileBarChart" },
    { label: "Reports", href: "/chief/reports", icon: "FileText" },
    { label: "Announcements", href: "/chief/announcements", icon: "Megaphone" },
    { label: "Messages", href: "/chief/messages", icon: "MessageSquare" },
  ],
  SUPERVISOR: [
    { label: "Dashboard", href: "/supervisor", icon: "LayoutDashboard" },
    { label: "Mentors", href: "/supervisor/mentors", icon: "GraduationCap" },
    { label: "Students", href: "/supervisor/students", icon: "UserRound" },
    { label: "Reports Review", href: "/supervisor/reports", icon: "FileText" },
    { label: "Assessments", href: "/supervisor/assessments", icon: "FileBarChart" },
    { label: "Sessions", href: "/supervisor/sessions", icon: "CalendarDays" },
    { label: "Feedback", href: "/supervisor/feedback", icon: "MessageCircle" },
    { label: "Messages", href: "/supervisor/messages", icon: "MessageSquare" },
  ],
  MENTOR: [
    { label: "Dashboard", href: "/mentor", icon: "LayoutDashboard" },
    { label: "My Mentees", href: "/mentor/mentees", icon: "UserRound" },
    { label: "Sessions", href: "/mentor/sessions", icon: "CalendarDays" },
    { label: "Reports", href: "/mentor/reports", icon: "FileText" },
    { label: "Tasks & Follow-ups", href: "/mentor/tasks", icon: "ListChecks" },
    { label: "Assessments", href: "/mentor/assessments", icon: "FileBarChart" },
    { label: "Messages", href: "/mentor/messages", icon: "MessageSquare" },
    { label: "Resources", href: "/mentor/resources", icon: "BookOpen" },
  ],
  PARENT: [
    { label: "Dashboard", href: "/parent", icon: "LayoutDashboard" },
    { label: "My Children", href: "/parent/children", icon: "UserRound" },
    { label: "Progress Reports", href: "/parent/reports", icon: "FileText" },
    { label: "Assessments", href: "/parent/assessments", icon: "FileBarChart" },
    { label: "Feedback", href: "/parent/feedback", icon: "MessageCircle" },
    { label: "Messages", href: "/parent/messages", icon: "MessageSquare" },
    { label: "Documents", href: "/parent/documents", icon: "FolderOpen" },
  ],
  STUDENT: [
    { label: "Dashboard", href: "/student", icon: "LayoutDashboard" },
    { label: "My Goals", href: "/student/goals", icon: "Target" },
    { label: "My Tasks", href: "/student/tasks", icon: "ListChecks" },
    { label: "Assessments", href: "/student/assessments", icon: "FileBarChart" },
    { label: "Achievements", href: "/student/achievements", icon: "Trophy" },
    { label: "Messages", href: "/student/messages", icon: "MessageSquare" },
  ],
};

// route prefix -> allowed roles (used by middleware)
export const ROUTE_GUARD: { prefix: string; roles: Role[] }[] = [
  { prefix: "/admin", roles: ["SUPER_ADMIN"] },
  { prefix: "/chief", roles: ["CHIEF_MENTOR", "SUPER_ADMIN"] },
  { prefix: "/supervisor", roles: ["SUPERVISOR", "CHIEF_MENTOR", "SUPER_ADMIN"] },
  { prefix: "/mentor", roles: ["MENTOR", "SUPERVISOR", "CHIEF_MENTOR", "SUPER_ADMIN"] },
  { prefix: "/parent", roles: ["PARENT", "SUPER_ADMIN"] },
  { prefix: "/student", roles: ["STUDENT", "SUPER_ADMIN"] },
];
