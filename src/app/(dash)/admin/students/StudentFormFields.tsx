import { Field } from "@/components/ui/form";

type Option = { id: string; name: string };

type StudentDefaults = {
  id?: string;
  fullName?: string | null; gender?: string | null; dob?: Date | null;
  className?: string | null; rollNo?: string | null; bloodGroup?: string | null;
  email?: string | null; phone?: string | null; address?: string | null; city?: string | null;
  registrationNumber?: string | null; yearOfStudy?: string | null;
  institutionId?: string | null; mentorId?: string | null; parentId?: string | null;
  fatherOccupation?: string | null; motherOccupation?: string | null;
  plusTwoPercentage?: string | null; languagesKnown?: string | null;
  interests?: string | null; talents?: string | null; sports?: string | null; cultural?: string | null;
  hobbies?: string | null; careerAspiration?: string | null; otherTalent?: string | null; lifeGoal?: string | null;
  problems?: string | null; healthProblems?: string | null; mentorRemarks?: string | null;
  preferredMode?: string | null;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-3 mt-2 border-b border-slate-100 pb-1 text-sm font-bold text-navy">{children}</h4>;
}

const dateValue = (d?: Date | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

/** All Student master-profile inputs (mirrors the mentoring-record form). Shared by create & edit. */
export function StudentFormFields({
  student,
  institutions,
  mentors,
  parents,
}: {
  student?: StudentDefaults;
  institutions: Option[];
  mentors: Option[];
  parents: Option[];
}) {
  return (
    <div className="space-y-4">
      {student?.id && <input type="hidden" name="id" defaultValue={student.id} />}

      <SectionTitle>Student profile</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input name="fullName" className="input" required defaultValue={student?.fullName ?? ""} placeholder="Muhammed Sinan" />
        </Field>
        <Field label="Gender">
          <select name="gender" className="input" defaultValue={student?.gender ?? ""}>
            <option value="">— Select —</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </Field>
        <Field label="Date of birth">
          <input name="dob" type="date" className="input" defaultValue={dateValue(student?.dob)} />
        </Field>
        <Field label="Registration number">
          <input name="registrationNumber" className="input" defaultValue={student?.registrationNumber ?? ""} placeholder="REG-2026-001" />
        </Field>
        <Field label="Class / Grade">
          <input name="className" className="input" defaultValue={student?.className ?? ""} placeholder="Grade 9" />
        </Field>
        <Field label="Year of study">
          <input name="yearOfStudy" className="input" defaultValue={student?.yearOfStudy ?? ""} placeholder="First year" />
        </Field>
        <Field label="Roll number">
          <input name="rollNo" className="input" defaultValue={student?.rollNo ?? ""} placeholder="12" />
        </Field>
        <Field label="Blood group">
          <input name="bloodGroup" className="input" defaultValue={student?.bloodGroup ?? ""} placeholder="O+" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" className="input" defaultValue={student?.email ?? ""} placeholder="student@example.com" />
        </Field>
        <Field label="Phone">
          <input name="phone" className="input" defaultValue={student?.phone ?? ""} placeholder="+91 98470 00000" />
        </Field>
        <Field label="City">
          <input name="city" className="input" defaultValue={student?.city ?? ""} placeholder="Kochi" />
        </Field>
        <Field label="Address">
          <input name="address" className="input" defaultValue={student?.address ?? ""} placeholder="City, State" />
        </Field>
      </div>

      <SectionTitle>Assignment</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Institution">
          <select name="institutionId" className="input" defaultValue={student?.institutionId ?? ""}>
            <option value="">— None —</option>
            {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </Field>
        <Field label="Mentor">
          <select name="mentorId" className="input" defaultValue={student?.mentorId ?? ""}>
            <option value="">— Unassigned —</option>
            {mentors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        <Field label="Parent / Guardian">
          <select name="parentId" className="input" defaultValue={student?.parentId ?? ""}>
            <option value="">— None —</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
        <Field label="Preferred mentoring mode" hint="Drives mentor matching">
          <select name="preferredMode" className="input" defaultValue={student?.preferredMode ?? ""}>
            <option value="">— No preference —</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
            <option value="BOTH">Both</option>
          </select>
        </Field>
      </div>

      <SectionTitle>Family &amp; educational background</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Father's occupation">
          <input name="fatherOccupation" className="input" defaultValue={student?.fatherOccupation ?? ""} />
        </Field>
        <Field label="Mother's occupation">
          <input name="motherOccupation" className="input" defaultValue={student?.motherOccupation ?? ""} />
        </Field>
        <Field label="Marks in +2 (%)">
          <input name="plusTwoPercentage" className="input" defaultValue={student?.plusTwoPercentage ?? ""} placeholder="85%" />
        </Field>
        <Field label="Languages known">
          <input name="languagesKnown" className="input" defaultValue={student?.languagesKnown ?? ""} placeholder="Malayalam, English, Hindi" />
        </Field>
      </div>

      <SectionTitle>Interests, talents &amp; aspirations</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Interests" hint="Comma-separated">
          <input name="interests" className="input" defaultValue={student?.interests ?? ""} placeholder="Robotics, Football, Reading" />
        </Field>
        <Field label="Talents" hint="Comma-separated">
          <input name="talents" className="input" defaultValue={student?.talents ?? ""} placeholder="Public speaking, Coding" />
        </Field>
        <Field label="Sports (interest & achievements)">
          <textarea name="sports" className="input" rows={2} defaultValue={student?.sports ?? ""} />
        </Field>
        <Field label="Cultural (interest & achievements)">
          <textarea name="cultural" className="input" rows={2} defaultValue={student?.cultural ?? ""} />
        </Field>
        <Field label="Hobbies">
          <input name="hobbies" className="input" defaultValue={student?.hobbies ?? ""} placeholder="Painting, Chess" />
        </Field>
        <Field label="Career aspiration">
          <input name="careerAspiration" className="input" defaultValue={student?.careerAspiration ?? ""} placeholder="Engineer, Doctor…" />
        </Field>
        <Field label="Any other talent / skill">
          <input name="otherTalent" className="input" defaultValue={student?.otherTalent ?? ""} />
        </Field>
        <Field label="Life goal">
          <input name="lifeGoal" className="input" defaultValue={student?.lifeGoal ?? ""} />
        </Field>
      </div>

      <SectionTitle>Additional information</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Any problems">
          <textarea name="problems" className="input" rows={2} defaultValue={student?.problems ?? ""} />
        </Field>
        <Field label="Any health problems">
          <textarea name="healthProblems" className="input" rows={2} defaultValue={student?.healthProblems ?? ""} />
        </Field>
        <Field label="Mentor's remarks">
          <textarea name="mentorRemarks" className="input sm:col-span-2" rows={2} defaultValue={student?.mentorRemarks ?? ""} />
        </Field>
      </div>
    </div>
  );
}
