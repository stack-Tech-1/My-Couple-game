"use client";

import Link from "next/link";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Avatar, type AvatarMotif } from "@/design/Avatar";
import { Button } from "@/design/Button";
import { TextField } from "@/design/Field";
import { toast } from "@/design/toast";
import { MAX_DISPLAY_NAME } from "@/lib/config";
import { updateProfile } from "@/lib/room/actions";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { AvatarPicker, motifOf } from "./AvatarPicker";

/** Your name and avatar, as everyone sees them, with an inline editor. */
export function ProfileEditor() {
  const { bundle } = useRoom();
  const router = useRouter();
  const profile = bundle.me.profile;
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.display_name);
  const [motif, setMotif] = useState<AvatarMotif>(motifOf(profile.avatar_key));
  const [hue, setHue] = useState(profile.avatar_hue);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const open = () => {
    setName(profile.display_name);
    setMotif(motifOf(profile.avatar_key));
    setHue(profile.avatar_hue);
    setError(null);
    setEditing(true);
  };

  function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await updateProfile({ display_name: name, avatar_key: motif, avatar_hue: hue });
      if (!res.ok) return setError(res.error);
      setEditing(false);
      toast.success("Saved. Everyone sees the new you.");
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-4">
        <Avatar name={profile.display_name} motif={motifOf(profile.avatar_key)} hue={profile.avatar_hue} size={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[1.1rem] font-semibold">{profile.display_name}</p>
          <p className="text-[0.85rem] text-muted">Your name and mark, in every room.</p>
          <Link prefetch={false} href={`/room/${bundle.room.id}/you`} className="text-[0.85rem] font-semibold underline underline-offset-2">
            See your stats
          </Link>
        </div>
        <Button variant="outline" size="sm" onClick={open}>
          Edit
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={save} aria-label="Edit your name and mark">
      <div className="flex items-center gap-4">
        <Avatar name={name || "You"} motif={motif} hue={hue} size={56} />
        <div className="flex-1">
          <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={MAX_DISPLAY_NAME} autoComplete="given-name" required autoFocus />
        </div>
      </div>
      <AvatarPicker motif={motif} hue={hue} onMotif={setMotif} onHue={setHue} />
      {error ? (
        <p role="alert" className="mt-4 font-medium text-accent-ink">
          {error}
        </p>
      ) : null}
      <div className="mt-6 flex gap-3">
        <Button type="submit" variant="accent" loading={pending}>
          Save
        </Button>
        <Button variant="ghost" onClick={() => setEditing(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
