import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/design/Logo";
import { getMyProfile, getMyRooms } from "@/lib/room/server";
import { peekInvite } from "@/lib/room/actions";
import { MAX_FRIEND_ROOMS } from "@/lib/room/types";
import { JoinButton } from "./JoinButton";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = { title: "You're invited" };
export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const profile = await getMyProfile();
  if (!profile) redirect(`/sign-in?next=/join/${encodeURIComponent(code)}`);
  if (!profile.onboarded_at) redirect(`/onboarding?next=/join/${encodeURIComponent(code)}`);

  const [rooms, peek] = await Promise.all([getMyRooms(), peekInvite(code)]);
  const invite = peek.ok ? peek.data : null;
  const couple = rooms.find((r) => r.kind === "couple");
  const friendRooms = rooms.filter((r) => r.kind === "friends").length;
  const button = "mt-8 inline-flex h-12 items-center rounded-full bg-fg px-6 font-semibold text-bg";

  let body: React.ReactNode;
  if (!invite) {
    body = (
      <>
        <h1 className="display text-[clamp(2.6rem,9vw,4rem)]">This door&apos;s been bricked up.</h1>
        <p className="mt-4 text-muted">
          {peek.ok ? "The invite code doesn't exist any more. A couple room retires its code once both people are in, and a friend room's owner can change it." : peek.error}{" "}
          Ask whoever invited you for a fresh link.
        </p>
      </>
    );
  } else if (rooms.some((r) => r.id === invite.room_id)) {
    body = (
      <>
        <h1 className="display text-[clamp(2.6rem,9vw,4rem)]">You&apos;re already in.</h1>
        <p className="mt-4 text-muted">You&apos;re a member of <b className="text-fg">{invite.room_name}</b>.</p>
        <Link href={`/room/${invite.room_id}`} className={button}>Go to the room</Link>
      </>
    );
  } else if (invite.kind === "couple" && couple) {
    body = (
      <>
        <h1 className="display text-[clamp(2.6rem,9vw,4rem)]">You&apos;re already spoken for.</h1>
        <p className="mt-4 text-muted">
          You&apos;re in <b className="text-fg">{couple.name}</b>, and you can only be in one couple room at a time. To join {invite.inviter_name || "this room"}, leave your current couple room first from its settings.
        </p>
        <Link href={`/room/${couple.id}`} className={button}>Back to my room</Link>
      </>
    );
  } else if (invite.kind === "friends" && friendRooms >= MAX_FRIEND_ROOMS) {
    body = (
      <>
        <h1 className="display text-[clamp(2.6rem,9vw,4rem)]">Your hands are full.</h1>
        <p className="mt-4 text-muted">You&apos;re in {MAX_FRIEND_ROOMS} friend rooms already, which is the most. Leave one from its settings to make space for {invite.room_name}.</p>
        <Link href="/room" className={button}>Back to my rooms</Link>
      </>
    );
  } else if (invite.is_full) {
    body = (
      <>
        <h1 className="display text-[clamp(2.6rem,9vw,4rem)]">{invite.kind === "couple" ? "Two's company." : "Every seat's taken."}</h1>
        <p className="mt-4 text-muted">{invite.kind === "couple" ? "That room already has both its people." : "That friend room already has eight people, which is the most."}</p>
      </>
    );
  } else {
    body = (
      <>
        <p className="eyebrow text-accent-ink">{invite.kind === "couple" ? "An invitation" : `A friend room · ${invite.member_count} ${invite.member_count === 1 ? "person" : "people"} so far`}</p>
        <h1 className="display mt-4 text-[clamp(2.6rem,9vw,4.4rem)]">
          {invite.inviter_name || "Someone"} saved you a seat in <span className="display-wonk italic">{invite.room_name}</span>.
        </h1>
        <p className="mt-5 text-muted">
          {invite.kind === "couple"
            ? "Once you join, the room locks to the two of you. Nobody else gets in."
            : "Games and a group chat for up to eight. Everyone in the room can see the chat and who's playing."}
        </p>
        <JoinButton code={code} />
      </>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-5 sm:px-8">
      <div className="flex items-center justify-between">
        <Link href="/"><Logo /></Link>
        <ThemeToggle />
      </div>
      <div className="flex flex-1 flex-col justify-center py-12">{body}</div>
    </div>
  );
}
