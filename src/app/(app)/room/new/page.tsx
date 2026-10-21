import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/design/Logo";
import { Icon } from "@/design/icons";
import { getMyProfile, getMyRooms, homeRoomId } from "@/lib/room/server";
import { NewRoomForm } from "@/components/friends/NewRoomForm";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = { title: "New room" };
export const dynamic = "force-dynamic";

/** Start or join another room (a friend room, or a couple room if you don't have one). */
export default async function NewRoomPage() {
  const profile = await getMyProfile();
  if (!profile) redirect("/sign-in?next=/room/new");
  if (!profile.onboarded_at) redirect("/onboarding");
  const [rooms, home] = await Promise.all([getMyRooms(), homeRoomId()]);
  const hasCouple = rooms.some((r) => r.kind === "couple");
  const friendRooms = rooms.filter((r) => r.kind === "friends").length;

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col px-4 py-5 sm:px-8">
      <div className="flex items-center justify-between">
        <Logo />
        <span className="flex items-center gap-2">
        <ThemeToggle />
        {home ? (
          <Link prefetch={false} href={`/room/${home}`} className="inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-muted hover:text-fg">
            <Icon name="arrowLeft" size={16} /> Back
          </Link>
        ) : null}
        </span>
      </div>
      <div className="flex flex-1 flex-col py-12">
        <h1 className="display text-[clamp(2.6rem,9vw,3.8rem)]">Another room.</h1>
        <p className="mt-3 mb-10 text-muted">Start a friend room for your best friend or your group, or join one with a code. Everything in your other rooms stays where it is.</p>
        <NewRoomForm name={profile.display_name} hasCouple={hasCouple} friendRooms={friendRooms} />
      </div>
    </div>
  );
}
