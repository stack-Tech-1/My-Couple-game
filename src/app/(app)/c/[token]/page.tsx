import type { Metadata } from "next";
import Link from "next/link";
import { AdireFill } from "@/design/adire";
import { Logo } from "@/design/Logo";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getMyProfile, getUser } from "@/lib/room/server";
import { SOLO_LOOK, formatScore, soloGame } from "@/lib/solo/catalog";
import { SoloArt } from "@/components/solo/SoloArt";
import { AcceptChallenge } from "@/components/solo/AcceptChallenge";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "A challenge on Amah", robots: { index: false } };

/** A challenge link: who sent it, the score to beat, and one button to play. */
export default async function ChallengeLanding({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ok = /^[A-Za-z0-9_-]{10,40}$/.test(token);
  const { data: c } = ok ? await supabaseAdmin().from("solo_challenges").select("from_user, to_user, game_id, target, status, expires_at").eq("token", token).maybeSingle() : { data: null };
  const game = c ? soloGame(c.game_id as string) : undefined;
  const { data: from } = c ? await supabaseAdmin().from("profiles").select("display_name").eq("id", c.from_user).maybeSingle() : { data: null };
  const open = !!c && !!game && !c.to_user && c.status === "open" && Date.parse(c.expires_at as string) > Date.now();
  const user = await getUser();
  const profile = user ? await getMyProfile() : null;
  const next = `/c/${token}`;

  return (
    <div className="relative isolate mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-5 sm:px-8">
      <div className="absolute inset-x-0 top-0 -z-10 h-[420px] overflow-hidden">
        <AdireFill motif={SOLO_LOOK.motif} bg={SOLO_LOOK.bg} ink={SOLO_LOOK.ink} />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(201,138,18,0) 40%, var(--bg) 100%)" }} />
      </div>
      <Logo />
      {open && game ? (
        <div className="glass mt-10 rounded-[28px] p-6 text-center">
          <SoloArt id={game.id} className="mx-auto h-20 w-auto" />
          <p className="mt-4 text-[0.85rem] font-bold uppercase tracking-wide text-[#82601f]">A challenge from {(from?.display_name as string) ?? "a friend"}</p>
          <h1 className="display mt-2 text-[clamp(2.2rem,8vw,3rem)] leading-tight">Beat {formatScore(game, c!.target as number)}</h1>
          <p className="mt-2 text-muted">
            in {game.name}. {game.tagline}
          </p>
          <div className="mt-6">
            {!user ? (
              <Link prefetch={false} href={`/sign-in?next=${encodeURIComponent(next)}`} className="flex h-14 items-center justify-center rounded-full bg-accent text-[1.05rem] font-extrabold text-on-accent">
                Sign up free and play
              </Link>
            ) : !profile?.onboarded_at ? (
              <Link prefetch={false} href={`/onboarding?next=${encodeURIComponent(next)}`} className="flex h-14 items-center justify-center rounded-full bg-accent text-[1.05rem] font-extrabold text-on-accent">
                Set up your name, then play
              </Link>
            ) : (
              <AcceptChallenge token={token} />
            )}
          </div>
          <p className="mt-4 text-[0.82rem] text-muted">Amah is free. You&apos;ll join {(from?.display_name as string) ?? "them"} in a friend room, so you can play together after.</p>
        </div>
      ) : (
        <div className="glass mt-10 rounded-[28px] p-6 text-center">
          <h1 className="display text-[2rem] leading-tight">This challenge has been played</h1>
          <p className="mt-2 text-muted">Or it ran out (challenges last 7 days). There are plenty more games waiting.</p>
          <Link prefetch={false} href={user ? "/solo" : "/"} className="mt-6 inline-flex h-12 items-center rounded-full bg-fg px-6 font-bold text-bg">
            {user ? "Play Solo games" : "See what Amah is"}
          </Link>
        </div>
      )}
    </div>
  );
}
