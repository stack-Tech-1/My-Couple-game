import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Icon } from "@/design/icons";
import { getRoom } from "@/lib/room/server";
import { getProgress } from "@/lib/progress/server";
import { PLACE_ITEMS, placeOf } from "@/lib/engage/place";
import { PlaceScene } from "@/components/place/PlaceScene";
import { PlaceList } from "@/components/place/NewThings";

export const metadata: Metadata = { title: "Our place" };

/** A couple's own room that fills up as they do things together. Earned, never bought. */
export default async function PlacePage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const bundle = await getRoom(roomId);
  if (!bundle || bundle.room.kind !== "couple" || !bundle.partner) redirect(`/room/${roomId}`);
  const stats = await getProgress(roomId);
  const place = placeOf(stats);
  const rows = PLACE_ITEMS.map((i) => ({ id: i.id, name: i.name, how: i.how, value: Math.max(0, i.value(stats)), target: i.target, earned: place.have.includes(i.id) }));
  return (
    <div className="mx-auto max-w-3xl pt-6">
      <Link prefetch={false} href={`/room/${roomId}`} className="glass inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[0.9rem] font-semibold">
        <Icon name="arrowLeft" size={16} /> Home
      </Link>
      <div className="mt-6 flex items-baseline justify-between gap-3">
        <h1 className="display text-[clamp(2.2rem,8vw,3rem)] leading-none">Our place</h1>
        <p className="text-[0.9rem] font-semibold text-muted">
          {place.have.length} of {PLACE_ITEMS.length} things
        </p>
      </div>
      <p className="mt-2 text-muted">It fills up as you two do things together. Nothing here can be bought.</p>
      <div className="mt-5 overflow-hidden rounded-[26px] shadow-[0_24px_40px_-26px_rgba(28,20,22,.7)]">
        <PlaceScene have={place.have} level={place.level} className="block h-auto w-full" />
      </div>
      {place.next ? (
        <div className="glass mt-4 rounded-[18px] px-4 py-3">
          <div className="flex items-baseline justify-between gap-3 text-[0.95rem]">
            <b>Next: {place.next.item.name.replace(/^An? /, (m) => m.toLowerCase())}</b>
            <span className="text-[0.85rem] font-semibold text-muted">For {place.next.item.how}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunk" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(place.next.progress * 100)} aria-label="Progress to the next thing">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(place.next.progress * 100)}%` }} />
          </div>
        </div>
      ) : (
        <p className="glass mt-4 rounded-[18px] px-4 py-3 font-semibold">Every single thing. Your place is complete.</p>
      )}
      <div className="mt-8">
        <PlaceList roomId={roomId} rows={rows} />
      </div>
    </div>
  );
}
