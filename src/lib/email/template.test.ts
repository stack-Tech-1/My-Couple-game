import { describe, expect, it } from "vitest";
import { renderAnnouncement } from "./template";

const base = {
  name: "Ada",
  title: "Ludo just landed",
  body: "Roll the dice tonight.\n\nIt's under Head to head.",
  tone: "celebrate" as const,
  link: { url: "https://amah.example/room", label: "Play now" },
  siteUrl: "https://amah.example",
  unsubscribeUrl: "https://amah.example/email/unsubscribe?u=1&t=abc",
};

describe("announcement email", () => {
  it("renders the greeting, paragraphs, button and unsubscribe link", () => {
    const { subject, html, text } = renderAnnouncement(base);
    expect(subject).toBe("Ludo just landed");
    expect(html).toContain("Hi Ada,");
    expect(html.match(/<p style="margin:0 0 16px 0;font-family:Helvetica/g)?.length).toBe(3); // greeting + 2 paragraphs
    expect(html).toContain('href="https://amah.example/room"');
    expect(html).toContain("Something to celebrate");
    expect(html).toContain("https://amah.example/email/unsubscribe?u=1&amp;t=abc");
    expect(text).toContain("Play now: https://amah.example/room");
    expect(text).toContain("Stop announcement emails: https://amah.example/email/unsubscribe?u=1&t=abc");
  });

  it("escapes everything the admin or a user typed", () => {
    const { html } = renderAnnouncement({ ...base, name: "<b>Bo</b>", title: 'Hi "there" <script>', body: "a & b <img src=x>", link: { url: 'https://x.test/"onmouseover=', label: "<go>" } });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x>");
    expect(html).not.toContain("<b>Bo</b>");
    expect(html).toContain("&lt;b&gt;Bo&lt;/b&gt;");
    expect(html).toContain("a &amp; b &lt;img src=x&gt;");
    expect(html).toContain('href="https://x.test/&quot;onmouseover="');
  });

  it("leaves the button out when there's no link", () => {
    expect(renderAnnouncement({ ...base, link: null }).html).not.toContain("&rarr;</a>");
  });
});
