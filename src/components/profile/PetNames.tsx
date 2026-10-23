"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/design/Avatar";
import { Button } from "@/design/Button";
import { toast } from "@/design/toast";
import { MAX_DISPLAY_NAME } from "@/lib/config";
import { setNickname } from "@/lib/room/actions";
import { useRoom } from "@/lib/realtime/RoomProvider";
import type { Profile } from "@/lib/room/types";
import { motifOf } from "./AvatarPicker";

/** Private pet names for the other people in this room. Only you ever see them. */
export function PetNames() {
  const { bundle } = useRoom();
  const others = bundle.members.filter((m) => m.profile.id !== bundle.me.profile.id);
  if (!others.length) return null;
  return (
    <div className="mt-8">
      <p className="text-[0.82rem] font-semibold">{others.length === 1 ? "Pet name" : "Pet names"}</p>
      <p className="mt-1 text-[0.85rem] text-muted">What you call them, everywhere in Amah. Only you see it, never them.</p>
      <ul className="mt-3 flex flex-col gap-2">
        {others.map((m) => (
          <PetNameRow key={m.profile.id} profile={m.profile} />
        ))}
      </ul>
    </div>
  );
}

function PetNameRow({ profile }: { profile: Profile }) {
  const router = useRouter();
  const real = profile.real_name ?? profile.display_name;
  const current = profile.real_name ? profile.display_name : "";
  const [value, setValue] = useState(current);
  const [pending, start] = useTransition();
  const changed = value.trim() !== current;

  function save(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await setNickname(profile.id, value);
      if (!res.ok) return void toast.error(res.error);
      toast.success(value.trim() ? `${real} is “${value.trim()}” to you now.` : `Back to ${real}.`);
      router.refresh();
    });
  }

  return (
    <li>
      <form onSubmit={save} className="flex items-center gap-3 rounded-[14px] border-[1.5px] border-line bg-raised p-3" aria-label={`Pet name for ${real}`}>
        <Avatar name={real} motif={motifOf(profile.avatar_key)} hue={profile.avatar_hue} size={36} />
        <label className="min-w-0 flex-1">
          <span className="block truncate text-[0.78rem] text-muted">{real}</span>
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            maxLength={MAX_DISPLAY_NAME}
            placeholder="Baby, Oko mi, Sugar…"
            aria-label={`What you call ${real}`}
            className="w-full bg-transparent font-semibold placeholder:font-normal placeholder:text-muted focus:outline-none"
          />
        </label>
        <Button type="submit" size="sm" variant={changed ? "accent" : "ghost"} disabled={!changed} loading={pending}>
          {current && !value.trim() ? "Remove" : "Save"}
        </Button>
      </form>
    </li>
  );
}
