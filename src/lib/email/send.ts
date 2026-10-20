import "server-only";
import nodemailer from "nodemailer";
import { APP_NAME, siteUrl } from "@/lib/config";
import { supabaseAdmin } from "@/lib/supabase/server";
import { renderAnnouncement } from "./template";
import { oneClickUrl, unsubscribeUrl } from "./unsubscribe";

/**
 * Email goes out over SMTP. With Gmail: SMTP_USER is the address, SMTP_PASS a 16-character app
 * password (Google Account → Security → App passwords). Gmail allows roughly 500 a day; for more,
 * point SMTP_HOST/SMTP_PORT at a provider like Resend, Brevo or Postmark.
 */
export function emailConfigured(): boolean {
  return !!(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transport() {
  const port = Number(process.env.SMTP_PORT || 465);
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS!.replace(/\s+/g, "") },
    pool: true,
    maxConnections: 3,
  });
}

const from = () => process.env.EMAIL_FROM || `${APP_NAME} <${process.env.SMTP_USER}>`;

type Announcement = { id: string; title: string; body: string; tone: "info" | "celebrate" | "heads_up"; link_url: string | null; link_label: string | null };
type Recipient = { id: string; email: string; display_name: string };

function message(a: Announcement, r: Recipient) {
  const site = siteUrl();
  const unsub = unsubscribeUrl(r.id);
  const link = a.link_url ? { url: a.link_url.startsWith("/") ? `${site}${a.link_url}` : a.link_url, label: a.link_label ?? "Open Amah" } : { url: `${site}/room`, label: "Open Amah" };
  const { subject, html, text } = renderAnnouncement({ name: r.display_name, title: a.title, body: a.body, tone: a.tone, link, siteUrl: site, unsubscribeUrl: unsub });
  return {
    from: from(),
    to: r.email,
    subject,
    html,
    text,
    // One-click unsubscribe (RFC 8058): Gmail and Apple Mail show their own button for it.
    headers: { "List-Unsubscribe": `<${oneClickUrl(r.id)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
  };
}

async function loadAnnouncement(id: string): Promise<Announcement | null> {
  const { data } = await supabaseAdmin().from("announcements").select("id, title, body, tone, link_url, link_label").eq("id", id).maybeSingle();
  return (data as Announcement | null) ?? null;
}

/** Send one copy to a single address (the admin's own), to check how it looks. */
export async function sendTestEmail(announcementId: string, to: Recipient): Promise<void> {
  const a = await loadAnnouncement(announcementId);
  if (!a) throw new Error("That announcement is gone.");
  const t = transport();
  try {
    await t.sendMail({ ...message(a, to), subject: `[Test] ${a.title}` });
  } finally {
    t.close();
  }
}

/** Email an announcement to everyone who hasn't opted out. Returns how many were sent. */
export async function emailEveryone(announcementId: string): Promise<{ sent: number; failed: number }> {
  const admin = supabaseAdmin();
  const a = await loadAnnouncement(announcementId);
  if (!a) throw new Error("That announcement is gone.");
  const { data, error } = await admin.rpc("admin_email_recipients");
  if (error) throw error;
  const people = (data ?? []) as Recipient[];

  const t = transport();
  let sent = 0;
  let failed = 0;
  let next = 0;
  // Three at a time over the pooled connections.
  const worker = async () => {
    while (next < people.length) {
      const r = people[next++]!;
      try {
        await t.sendMail(message(a, r));
        sent++;
      } catch {
        failed++;
      }
    }
  };
  try {
    await Promise.all([worker(), worker(), worker()]);
  } finally {
    t.close();
  }
  await admin.from("announcements").update({ emailed_at: new Date().toISOString(), emailed_count: sent }).eq("id", announcementId);
  return { sent, failed };
}

export async function recipientCount(): Promise<number> {
  const { data } = await supabaseAdmin().rpc("admin_email_recipients");
  return ((data ?? []) as unknown[]).length;
}
