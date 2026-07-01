import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLE_LABEL } from "@/lib/rbac";
import { updateProfile, changePassword } from "@/lib/actions";
import { PageHeader } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton, Field } from "@/components/ui/form";
import { AvatarUpload } from "./AvatarUpload";

export default async function AccountPage() {
  const sess = await getSession();
  if (!sess) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: sess.userId },
    include: { institution: true },
  });
  if (!user) redirect("/login");

  return (
    <>
      <PageHeader title="Account settings" subtitle="Manage your profile photo, details and password" />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Profile">
          <ActionForm action={updateProfile} className="space-y-4" successMessage="Profile updated.">
            <AvatarUpload name={user.name} src={user.avatar} />

            <Field label="Full name">
              <input name="name" className="input" defaultValue={user.name} required />
            </Field>
            <Field label="Email" hint="Contact an administrator to change your login email.">
              <input className="input bg-slate-50 text-slate-500" value={user.email} disabled />
            </Field>
            <Field label="Role">
              <input
                className="input bg-slate-50 text-slate-500"
                value={ROLE_LABEL[user.role] + (user.institution ? ` · ${user.institution.name}` : "")}
                disabled
              />
            </Field>
            <Field label="Phone">
              <input name="phone" className="input" defaultValue={user.phone ?? ""} placeholder="+91 98470 00000" />
            </Field>
            <Field label="Title / Designation">
              <input name="title" className="input" defaultValue={user.title ?? ""} placeholder="Dr., Program Head…" />
            </Field>
            <Field label="Bio">
              <textarea name="bio" className="input min-h-24" defaultValue={user.bio ?? ""} placeholder="A short introduction" />
            </Field>

            <div className="flex justify-end pt-1">
              <SubmitButton>Save changes</SubmitButton>
            </div>
          </ActionForm>
        </Panel>

        <Panel title="Change password">
          <ActionForm action={changePassword} className="space-y-4" resetOnSuccess successMessage="Password updated.">
            <Field label="Current password">
              <input name="currentPassword" type="password" className="input" required autoComplete="current-password" />
            </Field>
            <Field label="New password" hint="At least 8 characters.">
              <input name="newPassword" type="password" className="input" required autoComplete="new-password" />
            </Field>
            <Field label="Confirm new password">
              <input name="confirmPassword" type="password" className="input" required autoComplete="new-password" />
            </Field>
            <div className="flex justify-end pt-1">
              <SubmitButton>Update password</SubmitButton>
            </div>
          </ActionForm>
        </Panel>
      </div>
    </>
  );
}
