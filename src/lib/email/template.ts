/**
 * Announcement email, in the same look as the branded sign-in emails (supabase/templates):
 * paper background, ink-bordered card, Georgia headline, ember button. Tables and inline styles
 * only, so it holds up in Gmail, Apple Mail and Outlook.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const EYEBROW: Record<"info" | "celebrate" | "heads_up", string> = { info: "News from Amah", celebrate: "Something to celebrate", heads_up: "Heads-up" };

export type AnnouncementEmail = {
  name: string;
  title: string;
  body: string;
  tone: "info" | "celebrate" | "heads_up";
  /** Absolute URL, or null for no button. */
  link: { url: string; label: string } | null;
  siteUrl: string;
  unsubscribeUrl: string;
};

export function renderAnnouncement(e: AnnouncementEmail): { subject: string; html: string; text: string } {
  const paragraphs = e.body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px 0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#57474a;">${esc(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
  const button = e.link
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr><td style="background:#e8563a;border-radius:999px;"><a href="${esc(e.link.url)}" style="display:inline-block;padding:15px 30px;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#1c1416;text-decoration:none;border-radius:999px;">${esc(e.link.label)} &rarr;</a></td></tr></table>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(e.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f6efe6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f6efe6;">${esc(e.body.slice(0, 120))}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6efe6;">
  <tr>
    <td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;">
        <tr>
          <td style="padding:0 4px 28px 4px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
              <td style="vertical-align:middle;padding-right:10px;"><img src="${esc(e.siteUrl)}/email/amah-mark.png" width="36" height="36" alt="Amah" style="display:block;border:0;border-radius:9px;"></td>
              <td style="vertical-align:middle;font-family:Georgia,'Times New Roman',serif;font-size:26px;letter-spacing:-0.5px;color:#1c1416;">amah</td>
            </tr></table>
          </td>
        </tr>
        <tr>
          <td style="background:#fbf7f1;border:1.5px solid #1c1416;border-radius:22px;padding:36px 32px;">
            <p style="margin:0 0 14px 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#b5371d;">${EYEBROW[e.tone]}</p>
            <h1 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;font-size:34px;line-height:1.08;font-weight:normal;letter-spacing:-1px;color:#1c1416;">${esc(e.title)}</h1>
            <p style="margin:0 0 16px 0;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.6;color:#57474a;">Hi ${esc(e.name)},</p>
            ${paragraphs}
            ${button}
          </td>
        </tr>
        <tr>
          <td style="padding:24px 4px 0 4px;font-family:Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#8a7a7d;">
            Amah &middot; game nights for two, or the whole squad.<br>
            You're getting this because you have an Amah account. <a href="${esc(e.unsubscribeUrl)}" style="color:#8a7a7d;">Stop announcement emails</a>.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    `Hi ${e.name},`,
    "",
    e.title,
    "",
    e.body,
    ...(e.link ? ["", `${e.link.label}: ${e.link.url}`] : []),
    "",
    "--",
    "Amah: game nights for two, or the whole squad.",
    `Stop announcement emails: ${e.unsubscribeUrl}`,
  ].join("\n");

  return { subject: e.title, html, text };
}
