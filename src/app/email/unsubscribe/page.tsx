import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogoMark } from "@/design/Logo";
import { applyOptOut } from "@/lib/email/optout";

export const metadata: Metadata = { title: "Email preferences", robots: { index: false, follow: false } };

/**
 * Opening the link doesn't unsubscribe on its own (link scanners open links too); the button
 * does. No sign-in needed: the link is signed for this one account.
 */
export default async function Unsubscribe({ searchParams }: { searchParams: Promise<{ u?: string; t?: string; done?: string }> }) {
  const { u, t, done } = await searchParams;

  async function update(formData: FormData) {
    "use server";
    const emails = formData.get("emails") === "on";
    const ok = await applyOptOut(formData.get("u"), formData.get("t"), emails);
    redirect(`/email/unsubscribe?u=${encodeURIComponent(String(formData.get("u")))}&t=${encodeURIComponent(String(formData.get("t")))}&done=${ok ? (emails ? "on" : "off") : "bad"}`);
  }

  const valid = !!u && !!t;
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-16">
      <div className="flex items-center gap-2.5">
        <LogoMark size={30} />
        <span className="display text-[1.5rem]">Amah</span>
      </div>
      <div className="mt-8 rounded-[22px] border-[1.5px] border-line-strong bg-raised p-7">
        {!valid || done === "bad" ? (
          <>
            <h1 className="display text-[2rem] leading-tight">That link didn&apos;t work.</h1>
            <p className="mt-3 text-muted">It may have been copied only partly. Use the link at the bottom of any Amah email, or change this in your room&apos;s settings.</p>
          </>
        ) : done === "off" ? (
          <>
            <h1 className="display text-[2rem] leading-tight">You&apos;re off the list.</h1>
            <p className="mt-3 text-muted">No more announcement emails. Sign-in links still arrive when you ask for them.</p>
            <form action={update} className="mt-6">
              <input type="hidden" name="u" value={u} />
              <input type="hidden" name="t" value={t} />
              <input type="hidden" name="emails" value="on" />
              <button className="text-[0.95rem] font-semibold text-accent-ink underline underline-offset-2">Changed your mind? Turn them back on</button>
            </form>
          </>
        ) : (
          <>
            <h1 className="display text-[2rem] leading-tight">{done === "on" ? "You're back on the list." : "Stop announcement emails?"}</h1>
            <p className="mt-3 text-muted">
              {done === "on" ? "You'll hear about new games and news again." : "We only email about new games and important news, never more than now and then."}
            </p>
            {done === "on" ? null : (
              <form action={update} className="mt-6">
                <input type="hidden" name="u" value={u} />
                <input type="hidden" name="t" value={t} />
                <button className="inline-flex h-12 items-center rounded-full bg-fg px-6 font-semibold text-bg">Unsubscribe</button>
              </form>
            )}
          </>
        )}
      </div>
    </main>
  );
}
