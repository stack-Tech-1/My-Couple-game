import { listAnnouncements } from "@/lib/admin/server";
import { AnnouncementTools } from "@/components/admin/AnnouncementTools";
import { emailConfigured, recipientCount } from "@/lib/email/send";

// Emailing everyone runs inside the server action; give it room.
export const maxDuration = 300;

export default async function AdminAnnouncements() {
  const ready = emailConfigured();
  const [items, recipients] = await Promise.all([listAnnouncements(), ready ? recipientCount() : Promise.resolve(0)]);
  return (
    <div className="max-w-3xl">
      <h1 className="display text-[2.6rem] leading-none">Announcements</h1>
      <p className="mt-2 text-[0.9rem] text-muted">A banner at the top of every room, until it ends or each person dismisses it, and optionally an email to everyone who hasn’t opted out. Good for new games, events and maintenance notices.</p>
      <AnnouncementTools items={items} emailReady={ready} recipients={recipients} />
    </div>
  );
}
