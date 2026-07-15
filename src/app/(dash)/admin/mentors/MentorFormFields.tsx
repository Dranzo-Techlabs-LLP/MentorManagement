import { Field } from "@/components/ui/form";

type Option = { id: string; name: string };

type MentorDefaults = {
  id?: string;
  name?: string | null; email?: string | null; phone?: string | null; title?: string | null;
  institutionId?: string | null; managerId?: string | null;
  mentoringMode?: string | null; city?: string | null; timezone?: string | null;
  languages?: string | null; exposure?: string | null; yearsExperience?: number | null;
};

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h4 className="mb-3 mt-2 border-b border-slate-100 pb-1 text-sm font-bold text-navy">{children}</h4>;
}

/** All Mentor (User role=MENTOR) profile inputs. Shared by create & edit. */
export function MentorFormFields({
  mentor,
  institutions,
  supervisors,
  isCreate,
}: {
  mentor?: MentorDefaults;
  institutions: Option[];
  supervisors: Option[];
  isCreate: boolean;
}) {
  return (
    <div className="space-y-4">
      {mentor?.id && <input type="hidden" name="id" defaultValue={mentor.id} />}
      <input type="hidden" name="role" value="MENTOR" />

      <SectionTitle>Mentor details</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input name="name" className="input" required defaultValue={mentor?.name ?? ""} placeholder="Jane Doe" />
        </Field>
        <Field label="Email">
          <input name="email" type="email" className="input" required defaultValue={mentor?.email ?? ""} placeholder="jane@ndhrglobal.com" />
        </Field>
        <Field label="Phone">
          <input name="phone" className="input" defaultValue={mentor?.phone ?? ""} placeholder="+91 98470 00000" />
        </Field>
        <Field label="Title / Designation">
          <input name="title" className="input" defaultValue={mentor?.title ?? ""} placeholder="Mentor" />
        </Field>
        <Field label="Institution">
          <select name="institutionId" className="input" defaultValue={mentor?.institutionId ?? ""}>
            <option value="">— None —</option>
            {institutions.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </Field>
        <Field label="Reports to (Supervisor)">
          <select name="managerId" className="input" defaultValue={mentor?.managerId ?? ""}>
            <option value="">— None —</option>
            {supervisors.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </Field>
        {isCreate && (
          <Field label="Temporary password" hint="Defaults to Elevate@123 if left blank.">
            <input name="password" className="input" placeholder="Elevate@123" />
          </Field>
        )}
      </div>

      <SectionTitle>Mentoring profile &amp; matching</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mentoring mode">
          <select name="mentoringMode" className="input" defaultValue={mentor?.mentoringMode ?? ""}>
            <option value="">— Not set —</option>
            <option value="ONLINE">Online</option>
            <option value="OFFLINE">Offline</option>
            <option value="BOTH">Both</option>
          </select>
        </Field>
        <Field label="City">
          <input name="city" className="input" defaultValue={mentor?.city ?? ""} placeholder="Kochi" />
        </Field>
        <Field label="Languages">
          <input name="languages" className="input" defaultValue={mentor?.languages ?? ""} placeholder="English, Malayalam" />
        </Field>
        <Field label="Time zone">
          <input name="timezone" className="input" defaultValue={mentor?.timezone ?? ""} placeholder="GMT+5:30" />
        </Field>
        <Field label="Exposure">
          <input name="exposure" className="input" defaultValue={mentor?.exposure ?? ""} placeholder="International / European exposure" />
        </Field>
        <Field label="Years of experience">
          <input name="yearsExperience" type="number" min={0} className="input" defaultValue={mentor?.yearsExperience ?? ""} placeholder="5" />
        </Field>
      </div>
    </div>
  );
}
