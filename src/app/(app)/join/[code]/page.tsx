import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/design/Logo";
import { getMyProfile, getMyRoom } from "@/lib/room/server";
import { peekInvite } from "@/lib/room/actions";
import { JoinButton } from "./JoinButton";

export const metadata: Metadata = { title: "You're invited" };
export const dynamic = "force-dynamic";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const profile = await getMyProfile();
  if (!profile) redirect(`/sign-in?next=/join/${encodeURIComponent(code)}`);
  if (!profile.onboarded_at) redirect(`/onboarding?next=/join/${encodeURIComponent(code)}`);

  const [mine, peek] = await Promise.all([getMyRoom(), peekInvite(code)]);
  const invite = peek.ok ? peek.data : null;

  let body: React.ReactNode;
  if (!invite) {
    body = (
      <>
        <h1 className="display text-[clamp(2.6rem,9vw,4rem)]">This door&apos;s been bricked up.</h1>
        <p className="mt-4 text-muted">
          {peek.ok ? "The invite code doesn't exist, or the room is already paired and the code was retired." : peek.error}{" "}
          Ask your partner for a fresh link.
        </p>
      </>
    );
  } else if (mine) {
    body = (
      <>
        <h1 className="display text-[clamp(2.6rem,9vw,4rem)]">You&apos;re already spoken for.</h1>
        <p className="mt-4 text-muted">
          You&apos;re in <b className="text-fg">{mine.room.name}</b>. To join {invite.inviter_name || "this room"}, leave your current room first from its settings.
        </p>
        <Link href={`/room/${mine.room.id}`} className="mt-8 inline-flex h-12 items-center rounded-full bg-fg px-6 font-semibold text-bg">Back to my room</Link>
      </>
    );
  } else if (invite.is_full) {
    body = (
      <>
        <h1 className="display text-[clamp(2.6rem,9vw,4rem)]">Two&apos;s company.</h1>
        <p className="mt-4 text-muted">That room already has both its people.</p>
      </>
    );
  } else {
    body = (
      <>
        <p className="eyebrow text-accent-ink">An invitation</p>
        <h1 className="display mt-4 text-[clamp(2.6rem,9vw,4.4rem)]">
          {invite.inviter_name || "Someone"} saved you a seat in <span className="display-wonk italic">{invite.room_name}</span>.
        </h1>
        <p className="mt-5 text-muted">Once you join, the room locks to the two of you. Nobody else gets in.</p>
        <JoinButton code={code} />
      </>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-5 sm:px-8">
      <Link href="/" className="self-start"><Logo /></Link>
      <div className="flex flex-1 flex-col justify-center py-12">{body}</div>
    </div>
  );
}