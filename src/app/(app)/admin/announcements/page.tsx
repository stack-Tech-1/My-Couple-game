import { listAnnouncements } from "@/lib/admin/server";
import { AnnouncementTools } from "@/components/admin/AnnouncementTools";

export default async function AdminAnnouncements() {
  const items = await listAnnouncements();
  return (
    <div className="max-w-3xl">
      <h1 className="display text-[2.6rem] leading-none">Announcements</h1>
      <p className="mt-2 text-[0.9rem] text-muted">A banner at the top of every room, until it ends or each person dismisses it. Good for new games, events and maintenance notices.</p>
      <AnnouncementTools items={items} />
    </div>
  );
}
