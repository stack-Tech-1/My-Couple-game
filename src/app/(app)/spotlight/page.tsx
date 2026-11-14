import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/design/icons";
import { getUser, homeRoomId } from "@/lib/room/server";
import { currentSpotlight } from "@/lib/engage/spotlight";
import { SpotlightCards } from "@/components/spotlight/SpotlightCards";

export const metadata: Metadata = { title: "This week on Amah" };
export const dynamic = "force-dynamic";

/** Couple of the Week and Gang of the Week, for everyone. */
export default async function SpotlightPage() {
  const user = await getUser();
  if (!user) redirect("/sign-in?next=/spotlight");
  const [winners, home] = await Promise.all([currentSpotlight(), homeRoomId()]);
  return (
    <div className="min-h-dvh bg-[#0b3328] text-[#f4e2b0]">
      <div className="mx-auto max-w-xl px-4 pb-24 pt-6">
        <Link prefetch={false} href={home ? `/room/${home}` : "/solo"} className="inline-flex items-center gap-1.5 rounded-full border border-[#d6ad5566] px-4 py-2 text-[0.9rem] font-semibold">
          <Icon name="arrowLeft" size={16} /> Back
        </Link>
        <p className="mt-8 text-center text-[1.05rem] italic text-[#e8d39b]">This week on Amah</p>
        {winners.length ? (
          <SpotlightCards winners={winners} />
        ) : (
          <div className="mt-6 text-center">
            <h1 className="display text-[2.2rem] text-[#fff6dc]">The winners come out on Friday</h1>
            <p className="mt-3 text-[#cdb57a]">Every Friday morning, Couple of the Week and Gang of the Week. Play together, keep your streak, and your week might be next.</p>
          </div>
        )}
        <section aria-labelledby="how-h" className="mt-12 rounded-[22px] border border-[#d6ad5544] p-5 text-[0.92rem] leading-relaxed text-[#e8d9b0]">
          <h2 id="how-h" className="display text-[1.3rem] text-[#fff6dc]">How it works</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Every Thursday we look at the week just gone: days you showed up together, games finished, team-up wins and daily questions. After Dark never counts and is never shown.</li>
            <li>The best few couples and friend rooms are asked first. Nobody is ever shown without saying yes, and no answer counts as no.</li>
            <li>On Friday morning the best week that said yes wins, graded from A+ to C, and stays up until the next Friday.</li>
            <li>Only names, avatars and the week&apos;s numbers are shown. Never chats, photos, answers or pet names.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
