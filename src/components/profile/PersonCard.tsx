"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar } from "@/design/Avatar";
import { Modal } from "@/design/Modal";
import { LOVE_STYLE_INFO, type LoveStyle } from "@/content/together-quizzes";
import { formatBirthday } from "@/lib/birthdays";
import { loveStyleOf } from "@/lib/room/actions";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { ABOUT_FIELDS, type AboutKey } from "@/lib/room/types";
import { motifOf } from "./AvatarPicker";

const EVENT = "amah:person";

/** Open someone's About me card from anywhere in a room. */
export const openPerson = (id: string) => window.dispatchEvent(new CustomEvent(EVENT, { detail: id }));

/** Mounted once per room; shows the card for whoever was tapped. */
export function PersonCardHost() {
  const { bundle } = useRoom();
  const [id, setId] = useState<string | null>(null);
  const [style, setStyle] = useState<{ for: string; style: LoveStyle | null } | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => setId((e as CustomEvent<string>).detail);
    window.addEventListener(EVENT, onOpen);
    return () => window.removeEventListener(EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!id) return;
    let live = true;
    void loveStyleOf(id).then((r) => live && setStyle({ for: id, style: r.ok ? r.data : null }));
    return () => {
      live = false;
    };
  }, [id]);

  const person = bundle.members.find((m) => m.profile.id === id)?.profile;
  const mine = id === bundle.me.profile.id;
  const about = person?.about ?? {};
  const facts = (Object.keys(ABOUT_FIELDS) as AboutKey[]).filter((k) => k !== "line" && about[k]);
  const love = style?.for === id ? style.style : null;
  const empty = !facts.length && !about.line && !person?.birth_month && !love;

  return (
    <Modal open={!!person} onClose={() => setId(null)} title={person ? (mine ? "You" : person.display_name) : ""}>
      {person ? (
        <div>
          <div className="flex items-center gap-4">
            <Avatar name={person.display_name} motif={motifOf(person.avatar_key)} hue={person.avatar_hue} size={64} />
            <div className="min-w-0">
              {person.real_name ? <p className="text-[0.85rem] text-muted">{person.real_name} · your pet name for them is {person.display_name}</p> : null}
              {about.line ? <p className="display text-[1.3rem] leading-snug">“{about.line}”</p> : null}
            </div>
          </div>

          <dl className="mt-6 grid gap-3">
            {person.birth_month && person.birth_day ? <Fact label="Birthday" value={formatBirthday(person.birth_month, person.birth_day)} /> : null}
            {facts.map((k) => (
              <Fact key={k} label={ABOUT_FIELDS[k].label} value={about[k]!} />
            ))}
            {love ? <Fact label="Feels most loved through" value={LOVE_STYLE_INFO[love].label} hint={mine ? undefined : LOVE_STYLE_INFO[love].tip} /> : null}
          </dl>

          {empty ? (
            <p className="mt-2 text-muted">{mine ? "Nothing here yet." : `${person.display_name} hasn't filled this in yet.`}</p>
          ) : null}
          {mine ? (
            <Link prefetch={false} href={`/room/${bundle.room.id}/settings#you`} onClick={() => setId(null)} className="mt-6 inline-block font-semibold underline underline-offset-2">
              Edit your card
            </Link>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}

function Fact({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-[14px] border-[1.5px] border-line bg-raised px-4 py-3">
      <dt className="text-[0.78rem] text-muted">{label}</dt>
      <dd className="mt-0.5 font-semibold">{value}</dd>
      {hint ? <dd className="mt-1 text-[0.85rem] text-muted">{hint}</dd> : null}
    </div>
  );
}
