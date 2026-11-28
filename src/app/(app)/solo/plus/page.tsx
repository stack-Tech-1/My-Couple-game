import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BackButton } from "@/design/BackButton";
import { soloContext } from "@/lib/solo/context";
import { supabaseAdmin } from "@/lib/supabase/server";
import { plusLive, plusStatus, type Purchase } from "@/lib/plus/server";
import { PLANS, isStaffPlus, naira } from "@/lib/plus/plans";
import { PlusPanel, PlusTag } from "@/components/plus/PlusTag";
import { PlusPlans } from "@/components/plus/PlusPlans";
import { StopRenewing } from "@/components/plus/StopRenewing";
import { PageBackdrop } from "@/components/room/HomeBackdrop";
import { PAGE_LOOKS } from "@/games/look";

export const metadata: Metadata = { title: "Amah Plus" };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const longDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
const how = (c: string | null) => (c === "bank_transfer" ? "transfer" : c === "ussd" ? "USSD" : c === "bank" ? "bank" : "card");

/**
 * Amah Plus for someone playing Solo. Plus belongs to the person, so it doesn't need a room: from
 * here it's "Just me" (couple and group plans live in a room, where the people are).
 */
export default async function SoloPlusPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const ctx = await soloContext();
  // With a room, Plus is managed there, with every plan on offer.
  if (ctx.homeRoomId) redirect(`/room/${ctx.homeRoomId}/settings/plus`);
  const { payment } = await searchParams;
  const me = ctx.user.id;
  const admin = supabaseAdmin();
  const [live, status, { count: trials }, { data: bought }] = await Promise.all([
    plusLive(),
    plusStatus([me]),
    admin.from("plus_trials").select("email_key", { count: "exact", head: true }).eq("user_id", me),
    admin.from("plus_purchases").select("*").eq("payer_id", me).neq("status", "pending").neq("status", "failed").order("created_at", { ascending: false }).limit(30),
  ]);
  const purchases = (bought ?? []) as Purchase[];
  const until = status[me]?.until ?? null;
  const trial = !!until && !!status[me]?.trial;
  const renewing = purchases.find((p) => p.method === "card" && p.status === "paid" && !p.cancelled_at);
  const banner =
    payment === "paid"
      ? { tone: "good", text: "Payment received. Welcome to Amah Plus." }
      : payment === "pending"
        ? { tone: "wait", text: "We're waiting for Paystack to confirm your payment. Transfers can take a few minutes; this page updates when it lands." }
        : payment === "failed"
          ? { tone: "bad", text: "That payment didn't go through. Nothing was charged. Try again?" }
          : null;

  return (
    <div className="relative isolate mx-auto max-w-2xl pb-16 pt-6">
      <div className="relative isolate max-sm:pb-12">
        <PageBackdrop motif={PAGE_LOOKS.settings.motif} bg={PAGE_LOOKS.settings.bg} ink={PAGE_LOOKS.settings.ink} fit />
        <BackButton href="/solo" label="Solo" />
        <h1 className="display mt-5 text-[clamp(2.4rem,8vw,3.4rem)] leading-none max-sm:text-[#f6efe6]">Amah Plus</h1>
      </div>

      {banner ? (
        <p role="status" className={`cut-sm mt-4 px-4 py-3 text-[0.92rem] font-semibold ${banner.tone === "good" ? "bg-[#dcefd9] text-[#1f4d2a]" : banner.tone === "bad" ? "bg-[#f6d5cc] text-[#7a2e1f]" : "bg-[#f6e7c4] text-[#5e4320]"}`}>
          {banner.text}
        </p>
      ) : null}

      {!live ? (
        <div className="cloth mt-6 p-5">
          <p className="font-semibold">Everything in Amah is free for now.</p>
          <p className="mt-1 text-muted">When Amah Plus opens, this is where you&apos;ll get it.</p>
        </div>
      ) : (
        <>
          <PlusPanel className="cut mt-5 p-5 sm:p-6">
            <PlusTag label={until ? (trial ? "Trial" : "Plus") : "Free plan"} />
            <h2 className="display mt-3 text-[1.6rem] leading-tight">{until ? (trial ? "Your free trial is on" : "You have Plus") : "You're on the free plan"}</h2>
            <p className="mt-1 text-[0.88rem] opacity-85">
              {isStaffPlus(until)
                ? "Always on, on the house: you're on the Amah team."
                : until
                  ? renewing && renewing.period_end
                    ? `Renews ${longDay(renewing.period_end)}${renewing.card_last4 ? ` on card ending ${renewing.card_last4}` : ""}, ${naira(renewing.amount_kobo / 100)}.`
                    : `Plus until ${longDay(until)}. Nothing renews; we'll remind you before it ends.`
                  : "Every Solo game with no daily limits: every wall of Bash Am, every day of Mama Put, every level of Zobo Sort. Plus works in every room you join later."}
            </p>
          </PlusPanel>

          {until && !trial ? null : (
            <section aria-labelledby="plans-h" className="cloth mt-4 p-5">
              <h2 id="plans-h" className="display mb-3 text-[1.4rem]">{trial ? "Keep Plus after your trial" : "Get Amah Plus"}</h2>
              <PlusPlans trialAvailable={!trials && !until} />
              <p className="mt-3 text-[0.82rem] text-muted">Plans for a couple or a group of friends are in a room&apos;s settings, once you have one.</p>
            </section>
          )}

          {renewing ? <StopRenewing endsOn={renewing.period_end ? longDay(renewing.period_end) : null} /> : null}

          {purchases.length ? (
            <section aria-labelledby="payments-h" className="mt-8">
              <h2 id="payments-h" className="display mb-3 text-[1.4rem]">Payments</h2>
              <ul className="cloth px-4">
                {purchases.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{p.renews_from ? `${PLANS[p.plan].label}, renewed` : `${PLANS[p.plan].label}, ${p.period === "year" ? "yearly" : "monthly"}`}</p>
                      <p className="text-[0.8rem] text-muted">
                        {day(p.paid_at ?? p.created_at)} · {p.status === "refunded" ? "refunded" : p.status === "disputed" ? "disputed" : how(p.channel)}
                      </p>
                    </div>
                    <p className="font-extrabold">{naira(p.amount_kobo / 100)}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}
