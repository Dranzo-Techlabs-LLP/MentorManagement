import {
  BookOpen,
  ClipboardList,
  Target,
  MessageSquare,
  ShieldCheck,
  GraduationCap,
} from "lucide-react";
import { PageHeader } from "@/components/ui/primitives";

const RESOURCES = [
  {
    icon: BookOpen,
    tint: "#0E2A5E",
    title: "Mentoring Session Guide",
    description: "Structure for one-to-one and group sessions: opening, growth review, goal-setting and closing reflection.",
  },
  {
    icon: ClipboardList,
    tint: "#14A1A8",
    title: "Assessment Interpretation Guide",
    description: "How to read aptitude, personality and multiple-intelligence results and translate them into guidance.",
  },
  {
    icon: Target,
    tint: "#2FA84F",
    title: "Goal-Setting Framework",
    description: "SMART goal templates across the six SLEP growth dimensions, with progress-tracking checkpoints.",
  },
  {
    icon: MessageSquare,
    tint: "#E0A92E",
    title: "Parent Communication Templates",
    description: "Ready-to-use message templates for progress updates, session summaries and concern escalation.",
  },
  {
    icon: ShieldCheck,
    tint: "#e11d48",
    title: "Safeguarding & Child Protection",
    description: "Mandatory policy, reporting procedures and code of conduct for working with young people.",
  },
  {
    icon: GraduationCap,
    tint: "#6d28d9",
    title: "SLEP Program Handbook",
    description: "Full overview of the Student Leadership Empowerment Program: levels, curriculum and milestones.",
  },
];

export default async function MentorResourcesPage() {
  return (
    <>
      <PageHeader title="Resources" subtitle="Guides, frameworks and policies for SLEP mentors" />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {RESOURCES.map((r) => {
          const Icon = r.icon;
          return (
            <div key={r.title} className="card flex flex-col p-5">
              <div
                className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ background: `${r.tint}1a`, color: r.tint }}
              >
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="font-bold text-navy">{r.title}</h3>
              <p className="mt-1 flex-1 text-sm text-slate-500">{r.description}</p>
              <button className="btn-outline mt-4 w-full">Open</button>
            </div>
          );
        })}
      </div>
    </>
  );
}
