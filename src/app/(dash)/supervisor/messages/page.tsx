import { redirect } from "next/navigation";
import { Send, Inbox, MailOpen } from "lucide-react";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { sendMessage } from "@/lib/actions";
import { PageHeader, Avatar, Badge, EmptyState } from "@/components/ui/primitives";
import { Panel } from "@/components/dash/widgets";
import { Modal } from "@/components/ui/Modal";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton, Field } from "@/components/ui/form";
import { timeAgo, titleCase } from "@/lib/utils";

/** Supervisor inbox + sent. Compose targets the supervisor's mentors and chief mentors. */
export default async function SupervisorMessagesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [inbox, sent, recipients] = await Promise.all([
    prisma.message.findMany({
      where: { recipientId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { sender: true },
    }),
    prisma.message.findMany({
      where: { senderId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { recipient: true },
    }),
    prisma.user.findMany({
      where: {
        id: { not: session.userId },
        OR: [{ managerId: session.userId, role: "MENTOR" }, { role: "CHIEF_MENTOR" }],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);

  const unread = inbox.filter((m) => !m.isRead).length;

  return (
    <>
      <PageHeader
        title="Messages"
        subtitle={`Supervisor inbox · ${unread} unread`}
        action={<ComposeModal recipients={recipients} />}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel
          title={
            <span className="flex items-center gap-2">
              <Inbox className="h-4 w-4" /> Inbox {unread > 0 && <Badge tone="red">{unread}</Badge>}
            </span>
          }
        >
          {inbox.length === 0 ? (
            <EmptyState title="No messages" hint="Incoming messages appear here." />
          ) : (
            <div className="divide-y divide-slate-50">
              {inbox.map((m) => (
                <MessageRow
                  key={m.id}
                  name={m.sender.name}
                  role={m.sender.role}
                  avatar={m.sender.avatar}
                  subject={m.subject}
                  body={m.body}
                  time={timeAgo(m.createdAt)}
                  unread={!m.isRead}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel
          title={
            <span className="flex items-center gap-2">
              <MailOpen className="h-4 w-4" /> Sent
            </span>
          }
        >
          {sent.length === 0 ? (
            <EmptyState title="No sent messages" hint="Messages you send appear here." />
          ) : (
            <div className="divide-y divide-slate-50">
              {sent.map((m) => (
                <MessageRow
                  key={m.id}
                  name={`To: ${m.recipient.name}`}
                  role={m.recipient.role}
                  avatar={m.recipient.avatar}
                  subject={m.subject}
                  body={m.body}
                  time={timeAgo(m.createdAt)}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}

function MessageRow({
  name,
  role,
  avatar,
  subject,
  body,
  time,
  unread,
}: {
  name: string;
  role: string;
  avatar?: string | null;
  subject?: string | null;
  body: string;
  time: string;
  unread?: boolean;
}) {
  return (
    <div className="flex gap-3 py-3">
      <Avatar name={name.replace(/^To: /, "")} src={avatar} size={36} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-semibold text-slate-700">
            {unread && <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-leaf align-middle" />}
            {name}
          </p>
          <span className="shrink-0 text-xs text-slate-400">{time}</span>
        </div>
        <p className="text-xs text-slate-400">{titleCase(role)}</p>
        {subject && <p className="mt-1 text-sm font-medium text-slate-600">{subject}</p>}
        <p className="line-clamp-2 text-sm text-slate-500">{body}</p>
      </div>
    </div>
  );
}

function ComposeModal({ recipients }: { recipients: { id: string; name: string; role: string }[] }) {
  return (
    <Modal
      title="Compose Message"
      triggerClassName="btn-primary"
      triggerLabel={<><Send className="h-4 w-4" /> Compose</>}
    >
      <ActionForm action={sendMessage} className="space-y-4">
          <Field label="Recipient">
            <select name="recipientId" className="input" required defaultValue="">
              <option value="" disabled>
                Select a recipient…
              </option>
              {recipients.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} · {titleCase(u.role)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subject">
            <input name="subject" className="input" placeholder="Subject" />
          </Field>
          <Field label="Message">
            <textarea name="body" className="input" rows={5} required placeholder="Write your message…" />
          </Field>
          <div className="flex justify-end">
            <SubmitButton pendingText="Sending…">Send message</SubmitButton>
          </div>
      </ActionForm>
    </Modal>
  );
}
