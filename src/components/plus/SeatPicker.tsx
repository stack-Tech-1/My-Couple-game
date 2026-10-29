"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Avatar } from "@/design/Avatar";
import { Button } from "@/design/Button";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { giveSeat } from "@/lib/plus/actions";
import { PlusTag } from "./PlusTag";

/** Group plans: tick who gets a seat. Once given, a seat stays with that person. */
export function SeatPicker({ purchaseId, label, seats, endsOn, given }: { purchaseId: string; label: string; seats: number; endsOn: string; given: string[] }) {
  const router = useRouter();
  const { bundle } = useRoom();
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const left = seats - given.length;
  const nameOf = (id: string) => bundle.members.find((m) => m.profile.id === id)?.profile.display_name ?? "";

  const give = () =>
    start(async () => {
      for (const id of picked) {
        const r = await giveSeat(purchaseId, id);
        if (!r.ok) return void toast.error(r.error);
      }
      toast.success(picked.length === 1 ? `${nameOf(picked[0]!)} has Plus now.` : `${picked.length} friends have Plus now.`);
      setPicked([]);
      router.refresh();
    });

  const invite = bundle.room.invite_code ? `${typeof window === "undefined" ? "" : window.location.origin}/join/${bundle.room.invite_code}` : null;

  return (
    <section aria-labelledby={`seats-${purchaseId}`} className="glass mt-6 rounded-[26px] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id={`seats-${purchaseId}`} className="display text-[1.4rem]">Give out seats</h2>
        <PlusTag label={label} />
      </div>
      <div aria-hidden className="mt-3 flex gap-1.5">
        {Array.from({ length: seats }, (_, i) => (
          <span key={i} className={cn("h-2.5 flex-1 rounded-full", i < given.length ? "bg-[#2a1f4e] dark:bg-[#f6d26a]" : "bg-[rgba(28,20,22,.12)] dark:bg-[rgba(255,255,255,.15)]")} />
        ))}
      </div>
      <p className="mt-2 text-[0.85rem] text-muted">
        <b className="text-fg">
          {given.length} given, {left} waiting.
        </b>{" "}
        Seats end on {endsOn}. Once given, a seat stays with that person.
      </p>
      <ul className="mt-2">
        {bundle.members.map((m) => {
          const id = m.profile.id;
          const has = given.includes(id);
          const other = !has && !!bundle.plus.until[id];
          const on = has || picked.includes(id);
          const disabled = has || other || (!on && picked.length >= left);
          return (
            <li key={id} className="border-t border-line first:border-t-0">
              <label className={cn("flex items-center gap-3 py-2.5", disabled && !has ? "opacity-60" : "cursor-pointer")}>
                <input
                  type="checkbox"
                  className="h-5 w-5 accent-[#2a1f4e]"
                  checked={on}
                  disabled={disabled}
                  onChange={(e) => setPicked((cur) => (e.target.checked ? [...cur, id] : cur.filter((x) => x !== id)))}
                />
                <Avatar name={m.profile.display_name} motif={m.profile.avatar_key} hue={m.profile.avatar_hue} size={32} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{id === bundle.me.profile.id ? "You" : m.profile.display_name}</span>
                  {other ? <span className="block text-[0.78rem] text-muted">Already has Plus</span> : null}
                </span>
                <span className="text-[0.8rem] text-muted">{has ? "Given" : other ? "" : "No Plus"}</span>
              </label>
            </li>
          );
        })}
      </ul>
      {left > 0 ? (
        <Button className="mt-3 w-full" loading={pending} disabled={!picked.length} onClick={give}>
          {picked.length === 1 ? `Give seat to ${picked[0] === bundle.me.profile.id ? "me" : nameOf(picked[0]!)}` : picked.length ? `Give ${picked.length} seats` : "Tick who gets a seat"}
        </Button>
      ) : null}
      {left > 0 && invite ? (
        <div className="mt-4 flex items-center gap-3 rounded-[18px] bg-sunk p-3">
          <p className="min-w-0 flex-1 text-[0.85rem]">
            <b>Invite friends to use the rest.</b> Seats only go to people in this room.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void navigator.clipboard?.writeText(invite);
              toast.success("Invite link copied.");
            }}
          >
            Copy link
          </Button>
        </div>
      ) : null}
    </section>
  );
}
