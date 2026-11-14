import Link from "next/link";
import { PLACE_ITEMS, placeOf } from "@/lib/engage/place";
import type { Stats } from "@/lib/progress/model";
import { PlaceScene } from "./PlaceScene";

/** The room home's window into Our place: the room, and what's coming next. */
export function PlaceCard({ roomId, stats }: { roomId: string; stats: Stats }) {
  const place = placeOf(stats);
  return (
    <Link prefetch={false} href={`/room/${roomId}/place`} className="glass block overflow-hidden rounded-[24px]">
      <PlaceScene have={place.have} level={place.level} className="block h-auto w-full" />
      <div className="px-4 py-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="display text-[1.35rem]">Our place</p>
          <p className="text-[0.82rem] font-semibold text-muted">
            {place.have.length} of {PLACE_ITEMS.length} things
          </p>
        </div>
        {place.next ? (
          <>
            <p className="text-[0.85rem] text-muted">
              Next: {place.next.item.name.replace(/^An? /, (m) => m.toLowerCase())}, for {place.next.item.how}
            </p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-sunk" aria-hidden>
              <div className="h-full rounded-full bg-accent" style={{ width: `${Math.round(place.next.progress * 100)}%` }} />
            </div>
          </>
        ) : null}
      </div>
    </Link>
  );
}
