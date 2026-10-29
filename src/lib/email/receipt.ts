/**
 * Amah Plus receipt email: the crown-pattern header, the amount, then a simple table.
 * Tables and inline styles only, so it holds up in Gmail, Apple Mail and Outlook.
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

export type ReceiptEmail = {
  name: string;
  /** "You and Bo have Plus." / "You have Plus." / "Bayo has Plus." */
  headline: string;
  amount: string;
  paidOn: string;
  rows: [string, string][];
  siteUrl: string;
  openUrl: string;
  /** Card plans renew; passes and gifts don't. */
  renews: boolean;
};

export function renderReceipt(e: ReceiptEmail): { subject: string; html: string; text: string } {
  const subject = "Your Amah Plus receipt";
  const rows = e.rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:10px 0;border-top:1px solid #e7ded3;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#57474a;">${esc(k)}</td><td align="right" style="padding:10px 0;border-top:1px solid #e7ded3;font-family:Helvetica,Arial,sans-serif;font-size:14px;font-weight:700;color:#1c1416;">${esc(v)}</td></tr>`,
    )
    .join("");
  const footer = e.renews
    ? "Cancel any time in Settings, Amah Plus. Plus stays on until the end of the period you paid for."
    : "This was a one-off payment. Nothing renews; we'll remind you before it runs out.";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f6efe6;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f6efe6;">${esc(e.headline)} ${esc(e.amount)} paid.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6efe6;">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#fbf7f1;border:1px solid #e7ded3;border-radius:22px;overflow:hidden;">
        <tr>
          <td style="background:#2a1f4e;background-image:url('${esc(e.siteUrl)}/email/plus-crowns.png');background-repeat:repeat;padding:26px 28px 28px 28px;">
            <p style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;font-size:24px;color:#f6d26a;">Amah</p>
            <h1 style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.15;font-weight:normal;color:#f6efe6;">Thank you, ${esc(e.name)}.<br>${esc(e.headline)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 28px 8px 28px;">
            <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:40px;line-height:1;color:#1c1416;">${esc(e.amount)}</p>
            <p style="margin:6px 0 14px 0;font-family:Helvetica,Arial,sans-serif;font-size:14px;color:#57474a;">Paid ${esc(e.paidOn)}</p>
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows}</table>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px 0;"><tr><td style="background:#2a1f4e;border-radius:999px;"><a href="${esc(e.openUrl)}" style="display:inline-block;padding:14px 30px;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:700;color:#f6d26a;text-decoration:none;border-radius:999px;">Open Amah</a></td></tr></table>
            <p style="margin:16px 0 0 0;font-family:Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#57474a;">${esc(footer)} Our refund policy is in the <a href="${esc(e.siteUrl)}/terms#payments" style="color:#57474a;">Terms</a>.</p>
            <p style="margin:16px 0 22px 0;font-family:Helvetica,Arial,sans-serif;font-size:11px;color:#8a7a7c;">Stackcoding Technologies &middot; playamah.app</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;

  const text = [
    `Thank you, ${e.name}. ${e.headline}`,
    "",
    `${e.amount}, paid ${e.paidOn}`,
    ...e.rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `Open Amah: ${e.openUrl}`,
    "",
    footer,
    `Refund policy: ${e.siteUrl}/terms#payments`,
  ].join("\n");
  return { subject, html, text };
}
