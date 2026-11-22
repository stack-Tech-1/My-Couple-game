import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/design/Avatar";
import { Icon } from "@/design/icons";
import { SharePoster } from "@/components/room/SharePoster";
import { gameMeta } from "@/games/catalog";
import { getRoom, getUser } from "@/lib/room/server";
import { getProgress } from "@/lib/progress/server";
import { UsPanel } from "@/components/room/UsPanel";
import { PageBackdrop } from "@/components/room/HomeBackdrop";
import { PAGE_LOOKS } from "@/games/look";
import { supabaseServer } from "@/lib/supabase/server";
import { personalStats, type GameRow } from "@/lib/stats/personal";

export const metadata: Metadata = { title: "Your Amah" };

/** Your record across every room you're in: games, wins, streaks, favourites and head to heads. */
export default async function YourAmahPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const user = await getUser();
  if (!user) return null;
  const supabase = await supabaseServer();
  const { data: rows } = await supabase
    .from("game_sessions")
    .select("game_id, players, status, outcome, winner, finished_at")
    .contains("players", [user.id])
    .eq("status", "finished");
  const s = personalStats(user.id, (rows ?? []) as GameRow[]);

  // Names for the people you've played (only those you still share a room with; pet names win).
  const ids = s.vs.map((v) => v.id);
  const [{ data: people }, { data: nicks }] = ids.length
    ? await Promise.all([
        supabase.from("profiles").select("id, display_name, avatar_key, avatar_hue").in("id", ids),
        supabase.from("nicknames").select("target_id, nickname").in("target_id", ids),
      ])
    : [{ data: [] }, { data: [] }];
  const nick = new Map((nicks ?? []).map((n) => [n.target_id as string, n.nickname as string]));
  const who = new Map((people ?? []).map((p) => [p.id as string, { ...p, display_name: nick.get(p.id as string) ?? (p.display_name as string) }]));
  const pct = s.winRate === null ? null : Math.round(s.winRate * 100);
  // Couples: the shared level and badges sit at the top of the Us tab.
  const bundle = await getRoom(roomId);
  const couple = bundle?.room.kind !== "friends" && !!bundle?.partner;
  const progress = couple ? await getProgress(roomId) : null;
  const look = PAGE_LOOKS.us;

  return (
    <div className="relative isolate pb-24 pt-6">
      <PageBackdrop motif={look.motif} bg={look.bg} ink={look.ink} glow={look.glow} height={560} />
      <Link prefetch={false} href={`/room/${roomId}`} className="inline-flex items-center gap-1.5 text-[0.9rem] font-semibold text-muted hover:text-fg max-sm:text-[#f6efe6]/85">
        <Icon name="arrowLeft" size={16} /> Room
      </Link>
      <p className="eyebrow mt-8 text-muted max-sm:mt-6 max-sm:text-[#ffd65c]">{couple ? "The two of you, and you" : "Across all your rooms"}</p>
      <h1 className="display mt-2 text-[clamp(2.6rem,9vw,4rem)] leading-[1.02] max-sm:text-[#f6efe6]">{couple ? "Us" : "Your Amah"}</h1>
      {progress ? (
        <div className="mt-6 max-sm:mt-[3.25rem]">
          <UsPanel roomId={roomId} stats={progress} />
        </div>
      ) : null}
      {couple ? <h2 className="display mt-10 text-[1.8rem]">Your record</h2> : null}

      {s.played === 0 ? (
        <p className="glass mt-8 max-w-prose rounded-[22px] p-5 text-[1.05rem] leading-relaxed text-muted">No finished games yet. Play one and your numbers start here: wins, streaks, favourites and who you beat most.</p>
      ) : (
        <>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Big label="Games played" value={s.played} />
            <Big label="Wins" value={s.wins} sub={`${s.losses} lost · ${s.ties} tied`} />
            <Big label="Win rate" value={pct === null ? "–" : `${pct}%`} sub="games with a winner" />
            <Big label="Best win streak" value={s.bestStreak} sub={s.currentStreak > 1 ? `on ${s.currentStreak} right now` : undefined} />
          </dl>
          <div className="mt-4">
            <SharePoster roomId={roomId} label="Share my stats" variant="outline" />
          </div>
          {s.coopPlayed ? (
            <p className="mt-4 text-muted">
              Team games: <strong className="text-fg">{s.coopWins}</strong> won together out of {s.coopPlayed}.
            </p>
          ) : null}

          <section aria-labelledby="fav-h" className="glass mt-8 rounded-[22px] p-5">
            <h2 id="fav-h" className="eyebrow mb-4 text-muted">Your favourites</h2>
            <ol className="flex flex-col gap-2">
              {s.topGames.map((g, i) => (
                <li key={g.gameId} className="flex items-center gap-3">
                  <span className="display w-6 text-[1.4rem] text-muted">{i + 1}</span>
                  <span className="flex-1 font-semibold">{gameMeta(g.gameId)?.name ?? g.gameId}</span>
                  <span className="tabular text-muted">
                    {g.count} {g.count === 1 ? "game" : "games"}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {s.vs.length ? (
            <section aria-labelledby="vs-h" className="glass mt-4 rounded-[22px] p-5">
              <h2 id="vs-h" className="eyebrow mb-4 text-muted">Head to head</h2>
              <ul className="flex flex-col divide-y divide-line">
                {s.vs.map((v) => {
                  const p = who.get(v.id);
                  const name = p?.display_name ?? "Someone";
                  return (
                    <li key={v.id} className="flex items-center gap-3 py-3">
                      {p ? <Avatar name={name} motif={p.avatar_key as string} hue={p.avatar_hue as number} size={38} /> : <span className="h-[38px] w-[38px] rounded-full bg-sunk" />}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">You vs {name}</span>
                        <span className="block text-[0.82rem] text-muted">{v.wins > v.losses ? "You're ahead" : v.wins < v.losses ? `${name} is ahead` : "Dead level"}</span>
                      </span>
                      <span className="display tabular text-[1.5rem]">
                        {v.wins}–{v.losses}
                        {v.ties ? <span className="text-[0.9rem] text-muted"> ({v.ties} tied)</span> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </div>
  );
}

function Big({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="glass rounded-[18px] p-4">
      <dt className="text-[0.82rem] text-muted">{label}</dt>
      <dd className="display tabular mt-1 text-[2.4rem] leading-none">{value}</dd>
      {sub ? <dd className="mt-1.5 text-[0.78rem] text-muted">{sub}</dd> : null}
    </div>
  );
}
