import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/design/icons";
import { getRoom } from "@/lib/room/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { PageBackdrop } from "@/components/room/HomeBackdrop";
import { PAGE_LOOKS } from "@/games/look";
import { PLANS, isGroupPlan, isStaffPlus, naira } from "@/lib/plus/plans";
import type { Purchase } from "@/lib/plus/server";
import { PlusPanel, PlusTag } from "@/components/plus/PlusTag";
import { PlusPlans } from "@/components/plus/PlusPlans";
import { PlusManage } from "@/components/plus/PlusManage";
import { SeatPicker } from "@/components/plus/SeatPicker";
import { Avatar } from "@/design/Avatar";

export const metadata: Metadata = { title: "Amah Plus" };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
const longDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long" });
const how = (c: string | null) => (c === "bank_transfer" ? "transfer" : c === "ussd" ? "USSD" : c === "bank" ? "bank" : "card");

export default async function PlusPage({ params, searchParams }: { params: Promise<{ roomId: string }>; searchParams: Promise<{ payment?: string }> }) {
  const { roomId } = await params;
  const { payment } = await searchParams;
  const bundle = await getRoom(roomId);
  if (!bundle) redirect("/room");
  const me = bundle.me.profile.id;
  const admin = supabaseAdmin();

  const [{ data: bought }, { data: seats }] = await Promise.all([
    admin.from("plus_purchases").select("*").eq("payer_id", me).neq("status", "pending").neq("status", "failed").order("created_at", { ascending: false }).limit(30),
    admin.from("plus_seats").select("id, purchase_id, source, given_by, starts_at, ends_at, revoked_at, created_at").eq("user_id", me).order("created_at", { ascending: false }).limit(30),
  ]);
  const purchases = (bought ?? []) as Purchase[];
  const mySeats = seats ?? [];
  const until = bundle.plus.until[me];
  const trial = bundle.plus.trial.includes(me);
  const now = new Date().toISOString();

  const renewing = purchases.find((p) => p.method === "card" && p.status === "paid" && !p.cancelled_at);
  // Who my newest live payment covers (for "You and Bo have Plus").
  const live = purchases.find((p) => p.status === "paid" && p.period_end && p.period_end > now && !isGroupPlan(p.plan) && p.plan !== "gift");
  let coveredIds: string[] = [];
  if (live) {
    const { data } = await admin.from("plus_seats").select("user_id").eq("purchase_id", live.id).is("revoked_at", null);
    coveredIds = [...new Set((data ?? []).map((s) => s.user_id as string))];
  }
  const person = (id: string) => bundle.members.find((m) => m.profile.id === id)?.profile;
  const others = coveredIds.filter((id) => id !== me).map((id) => person(id)?.display_name ?? "your partner");

  // Group plans bought in this room that still have time on them.
  const groups = purchases.filter((p) => p.room_id === roomId && isGroupPlan(p.plan) && p.status === "paid" && p.period_end && p.period_end > now);
  const groupSeats = groups.length
    ? (await admin.from("plus_seats").select("purchase_id, user_id").in("purchase_id", groups.map((g) => g.id)).is("revoked_at", null)).data ?? []
    : [];

  const giftReceived = mySeats.filter((s) => s.source === "gift" && s.given_by && s.given_by !== me);
  const freebies = mySeats.filter((s) => s.source === "early" || s.source === "admin" || s.source === "trial");
  const history = [
    ...purchases.map((p) => ({
      at: p.paid_at ?? p.created_at,
      what: p.renews_from ? `${PLANS[p.plan].label}, renewed` : p.plan === "gift" ? "A seat for a friend" : `${PLANS[p.plan].label}, ${p.period === "year" ? "yearly" : "monthly"}`,
      how: p.status === "refunded" ? "refunded" : p.status === "disputed" ? "disputed" : how(p.channel),
      amount: naira(p.amount_kobo / 100),
    })),
    ...giftReceived.map((s) => ({ at: s.created_at as string, what: `Gift from ${person(s.given_by as string)?.display_name ?? "a friend"}`, how: "gift", amount: "Free" })),
    ...freebies.map((s) => ({ at: s.created_at as string, what: s.source === "early" ? "Thank-you month" : s.source === "trial" ? "Free trial" : "From the Amah team", how: s.source === "early" ? "early user" : s.source === "trial" ? "7 days" : "gift", amount: "Free" })),
  ].sort((a, b) => (a.at < b.at ? 1 : -1));

  const banner =
    payment === "paid"
      ? { tone: "good", text: "Payment received. Welcome to Amah Plus." }
      : payment === "pending"
        ? { tone: "wait", text: "We're waiting for Paystack to confirm your payment. Transfers can take a few minutes; this page updates when it lands." }
        : payment === "failed"
          ? { tone: "bad", text: "That payment didn't go through. Nothing was charged. Try again?" }
          : null;

  return (
    <div className="relative isolate mx-auto max-w-2xl pt-8">
      <PageBackdrop motif={PAGE_LOOKS.settings.motif} bg={PAGE_LOOKS.settings.bg} ink={PAGE_LOOKS.settings.ink} glow={PAGE_LOOKS.settings.glow} height={420} />
      <Link prefetch={false} href={`/room/${roomId}/settings`} className="inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-muted hover:text-fg max-sm:text-[#f6efe6]/85">
        <Icon name="arrowLeft" size={16} /> Settings
      </Link>
      <h1 className="display mt-4 text-[clamp(2.4rem,8vw,3.4rem)] max-sm:text-[#f6efe6]">Amah Plus</h1>

      {banner ? (
        <p role="status" className={`mt-4 rounded-[16px] px-4 py-3 text-[0.92rem] font-semibold ${banner.tone === "good" ? "bg-[#dcefd9] text-[#1f4d2a]" : banner.tone === "bad" ? "bg-[#f6d5cc] text-[#7a2e1f]" : "bg-[#f6e7c4] text-[#5e4320]"}`}>
          {banner.text}
        </p>
      ) : null}

      {!bundle.plus.live ? (
        <div className="glass mt-6 rounded-[24px] p-5">
          <p className="font-semibold">Everything in Amah is free for now.</p>
          <p className="mt-1 text-muted">When Amah Plus opens, this is where you&apos;ll manage it.</p>
        </div>
      ) : (
        <>
          <PlusPanel className="mt-5 rounded-[28px] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <PlusTag label={until ? (trial ? "Trial" : "Plus") : "Free plan"} />
              {renewing ? <span className="text-[0.82rem] opacity-85">{PLANS[renewing.plan].label}, {renewing.period === "year" ? "yearly" : "monthly"}</span> : null}
            </div>
            <h2 className="display mt-3 text-[1.6rem] leading-tight">
              {until ? (others.length ? `You and ${others.join(" and ")} have Plus` : trial ? "Your free trial is on" : "You have Plus") : "You're on the free plan"}
            </h2>
            <p className="mt-1 text-[0.88rem] opacity-85">
              {isStaffPlus(until)
                ? "Always on, on the house: you're on the Amah team, or with someone who is."
                : until
                ? renewing && renewing.period_end
                  ? `Renews ${longDay(renewing.period_end)}${renewing.card_last4 ? ` on card ending ${renewing.card_last4}` : ""}, ${naira(renewing.amount_kobo / 100)}.`
                  : `Plus until ${longDay(until)}. Nothing renews; we'll remind you before it ends.`
                : "Whot, Ludo, Ayo, Draughts, X and O, Connect Four, Daily Question and How Well Do You Know Me are always free."}
            </p>
            {until && coveredIds.length > 1 ? (
              <div className="mt-4 flex items-center gap-2">
                {coveredIds.map((id) => {
                  const p = person(id);
                  return p ? <Avatar key={id} name={p.display_name} motif={p.avatar_key} hue={p.avatar_hue} size={34} /> : null;
                })}
                <span className="ml-1 text-[0.85rem] opacity-85">Works in all your rooms</span>
              </div>
            ) : null}
          </PlusPanel>

          {until && !trial ? null : (
            <section aria-labelledby="plans-h" className="glass mt-4 rounded-[24px] p-5">
              <h2 id="plans-h" className="display mb-3 text-[1.4rem]">{trial ? "Keep Plus after your trial" : "Get Amah Plus"}</h2>
              <PlusPlans roomId={roomId} roomKind={bundle.room.kind} partnerName={bundle.partner?.profile.display_name ?? null} trialAvailable={!bundle.plus.trialUsed && !until} />
            </section>
          )}

          <PlusManage
            roomId={roomId}
            roomKind={bundle.room.kind}
            partnerName={bundle.partner?.profile.display_name ?? null}
            renewing={renewing ? { plan: renewing.plan, period: renewing.period, cardLast4: renewing.card_last4, endsOn: renewing.period_end ? longDay(renewing.period_end) : null } : null}
            hasPlus={!!until && !trial}
          />

          {groups.map((g) => (
            <SeatPicker
              key={g.id}
              purchaseId={g.id}
              label={PLANS[g.plan].label}
              seats={g.seats}
              endsOn={longDay(g.period_end!)}
              given={groupSeats.filter((s) => s.purchase_id === g.id).map((s) => s.user_id as string)}
            />
          ))}

          {history.length ? (
            <section aria-labelledby="payments-h" className="mt-8">
              <h2 id="payments-h" className="display mb-3 text-[1.4rem]">Payments</h2>
              <ul className="glass rounded-[22px] px-4">
                {history.map((h, i) => (
                  <li key={i} className="flex items-center gap-3 border-t border-line py-3 first:border-t-0">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{h.what}</p>
                      <p className="text-[0.8rem] text-muted">
                        {day(h.at)} · {h.how}
                      </p>
                    </div>
                    <p className={`font-extrabold ${h.amount === "Free" ? "text-[#3f9a5c]" : ""}`}>{h.amount}</p>
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
