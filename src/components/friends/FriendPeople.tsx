"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/design/Avatar";
import { Button } from "@/design/Button";
import { Modal } from "@/design/Modal";
import { toast } from "@/design/toast";
import { useRoom } from "@/lib/realtime/RoomProvider";
import { makeOwner, removeFriend, setBlocked } from "@/lib/room/actions";
import { ReportDialog } from "@/components/safety/ReportDialog";
import type { RoomPerson } from "@/lib/room/types";

type Ask = { kind: "owner" | "remove" | "block"; person: RoomPerson } | null;

/**
 * Everyone in a friend room. Anyone can report or block someone (blocking hides them from you;
 * nobody leaves). The owner can also hand the room over or remove someone.
 */
export function FriendPeople() {
  const { bundle } = useRoom();
  const router = useRouter();
  const { room, me, members, blocked } = bundle;
  const isOwner = room.owner_id === me.profile.id;
  const [ask, setAsk] = useState<Ask>(null);
  const [reporting, setReporting] = useState<RoomPerson | null>(null);
  const [pending, start] = useTransition();

  function confirm() {
    if (!ask) return;
    const { kind, person } = ask;
    const name = person.profile.display_name;
    start(async () => {
      const res =
        kind === "owner" ? await makeOwner(room.id, person.profile.id) : kind === "remove" ? await removeFriend(room.id, person.profile.id) : await setBlocked(person.profile.id, true);
      if (!res.ok) return void toast.error(res.error);
      toast.success(kind === "owner" ? `${name} owns the room now.` : kind === "remove" ? `${name} has been removed.` : `${name} is blocked.`);
      setAsk(null);
      router.refresh();
    });
  }

  function unblock(person: RoomPerson) {
    start(async () => {
      const res = await setBlocked(person.profile.id, false);
      if (!res.ok) return void toast.error(res.error);
      toast.info(`${person.profile.display_name} is unblocked.`);
      router.refresh();
    });
  }

  const askText: Record<NonNullable<Ask>["kind"], (n: string) => { title: string; body: string; cta: string }> = {
    owner: (n) => ({ title: `Make ${n} the owner?`, body: `${n} will be able to rename the room, share the invite code and remove people. You'll stay in the room as a member.`, cta: "Make owner" }),
    remove: (n) => ({ title: `Remove ${n}?`, body: `${n} leaves the room straight away. They can only come back with the invite code, so make a new code if you need to.`, cta: "Remove" }),
    block: (n) => ({ title: `Block ${n}?`, body: `Their messages and game invites will be hidden from you, and they can't start a game with you. Nobody is told, and nobody has to leave.`, cta: "Block" }),
  };
  const text = ask ? askText[ask.kind](ask.person.profile.display_name) : null;

  return (
    <>
      <ul className="flex flex-col divide-y divide-line">
        {members.map((p) => {
          const self = p.profile.id === me.profile.id;
          const isBlocked = blocked.includes(p.profile.id);
          const name = p.profile.display_name;
          return (
            <li key={p.profile.id} className="flex flex-wrap items-center gap-3 py-3">
              <Avatar name={name} motif={p.profile.avatar_key} hue={p.profile.avatar_hue} size={38} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  {name}
                  {self ? <span className="font-normal text-muted"> (you)</span> : null}
                </span>
                <span className="block text-[0.78rem] text-muted">{p.profile.id === room.owner_id ? "Owner" : isBlocked ? "Blocked by you" : "Member"}</span>
              </span>
              {self ? null : (
                <span className="flex flex-wrap gap-1.5">
                  {isOwner ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => setAsk({ kind: "owner", person: p })}>Make owner</Button>
                      <Button size="sm" variant="ghost" onClick={() => setAsk({ kind: "remove", person: p })}>Remove</Button>
                    </>
                  ) : null}
                  <Button size="sm" variant="ghost" onClick={() => setReporting(p)}>Report</Button>
                  {isBlocked ? (
                    <Button size="sm" variant="ghost" loading={pending} onClick={() => unblock(p)}>Unblock</Button>
                  ) : (
                    <Button size="sm" variant="ghost" className="text-accent-ink" onClick={() => setAsk({ kind: "block", person: p })}>Block</Button>
                  )}
                </span>
              )}
            </li>
          );
        })}
      </ul>

      <Modal open={!!ask} onClose={() => setAsk(null)} title={text?.title ?? ""} description={text?.body}>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" onClick={() => setAsk(null)}>Cancel</Button>
          <Button variant={ask?.kind === "owner" ? "primary" : "danger"} loading={pending} onClick={confirm}>{text?.cta}</Button>
        </div>
      </Modal>
      <ReportDialog
        open={!!reporting}
        onClose={() => setReporting(null)}
        partnerName={reporting?.profile.display_name ?? ""}
        target={reporting ? { roomId: room.id, userId: reporting.profile.id } : undefined}
        onBlockInstead={reporting && !blocked.includes(reporting.profile.id) ? () => setAsk({ kind: "block", person: reporting }) : undefined}
      />
    </>
  );
}
