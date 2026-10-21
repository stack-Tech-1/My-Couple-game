import { getRoom, startChecklist } from "@/lib/room/server";
import { WelcomeTour } from "@/components/room/WelcomeTour";
import { GettingStarted } from "@/components/room/GettingStarted";
import { activeSessions, scoreboard } from "@/lib/games/server";
import { Avatar } from "@/design/Avatar";
import { InvitePanel } from "@/components/room/InvitePanel";
import { ActiveGames } from "@/components/room/ActiveGames";
import { Library } from "@/components/room/Library";
import { InstallPrompt } from "@/components/room/InstallPrompt";
import { FRIEND_ROOM_SIZE } from "@/lib/room/types";
import Link from "next/link";
import { Icon } from "@/design/icons";
import { gameMeta } from "@/games/catalog";

/** Home of a friend room: who's here, the leaderboard, your games in progress, and the friend library. */
export async function FriendRoomHome({ roomId }: { roomId: string }) {
  const bundle = await getRoom(roomId);
  if (!bundle) return null;
  const [board, active, checklist] = await Promise.all([scoreboard(roomId), activeSessions(roomId), startChecklist(bundle)]);
  const me = bundle.me.profile.id;
  const isOwner = bundle.room.owner_id === me;
  const owner = bundle.members.find((m) => m.profile.id === bundle.room.owner_id);
  const ranked = [...bundle.members].sort((a, b) => (board.totals[b.profile.id] ?? 0) - (board.totals[a.profile.id] ?? 0));
  const anyWins = ranked.some((m) => (board.totals[m.profile.id] ?? 0) > 0);
  const nameOf = (id: string) => bundle.members.find((m) => m.profile.id === id)?.profile.display_name ?? "Someone";
  // Games the others are playing right now, to watch.
  const watchable = active.filter((s) => !s.players.includes(me) && gameMeta(s.game_id));

  return (
    <div className="pt-8 sm:pt-12">
      <p className="eyebrow text-muted">Friend room · {bundle.members.length} {bundle.members.length === 1 ? "person" : "people"}</p>
      <h1 className="display mt-2 text-[clamp(2.6rem,9vw,4.2rem)] leading-[1.02]">{bundle.room.name}</h1>
      <InstallPrompt />
      {isOwner && bundle.members.length < FRIEND_ROOM_SIZE ? <InvitePanel /> : null}
      {!isOwner && bundle.members.length < FRIEND_ROOM_SIZE ? (
        <p className="mt-4 text-muted">Want someone else in? {owner ? `${owner.profile.display_name} has the invite code.` : "The room's owner has the invite code."}</p>
      ) : null}
      <GettingStarted roomId={roomId} items={checklist} />
      <WelcomeTour />
      <ActiveGames sessions={active} me={me} />
      {watchable.length ? (
        <section aria-labelledby="live-h" className="mt-8">
          <h2 id="live-h" className="eyebrow text-muted">Live in this room</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {watchable.map((s) => (
              <li key={s.id}>
                <Link prefetch={false} href={`/room/${roomId}/watch/${s.id}`} className="flex items-center gap-3 rounded-[16px] border-[1.5px] border-line bg-raised px-4 py-3 hover:border-line-strong">
                  <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-accent" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{gameMeta(s.game_id)!.name}</span>
                    <span className="block truncate text-[0.85rem] text-muted">{s.players.map(nameOf).join(" vs ")}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[0.9rem] font-semibold">
                    Watch <Icon name="eye" size={16} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-14 grid gap-x-12 gap-y-14 lg:grid-cols-[1fr_2.2fr]">
        <section aria-labelledby="people-h">
          <h2 id="people-h" data-tour="people" className="eyebrow border-t-[1.5px] border-line-strong pt-5 text-muted">{anyWins ? "Who's winning" : "Who's here"}</h2>
          <ol className="mt-5 flex flex-col gap-3">
            {ranked.map((m, i) => (
              <li key={m.profile.id} className="flex items-center gap-3">
                {anyWins ? <span className="tabular w-5 text-right text-[0.85rem] text-muted">{i + 1}</span> : null}
                <Avatar name={m.profile.display_name} motif={m.profile.avatar_key} hue={m.profile.avatar_hue} size={38} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {m.profile.display_name}
                    {m.profile.id === me ? <span className="font-normal text-muted"> (you)</span> : null}
                  </span>
                  {m.profile.id === bundle.room.owner_id ? <span className="block text-[0.78rem] text-muted">Owner</span> : null}
                </span>
                {anyWins ? (
                  <span className="tabular text-[0.9rem] font-semibold">
                    {board.totals[m.profile.id] ?? 0} {(board.totals[m.profile.id] ?? 0) === 1 ? "win" : "wins"}
                  </span>
                ) : null}
              </li>
            ))}
          </ol>
          {bundle.members.length === 1 ? <p className="mt-4 text-[0.9rem] text-muted">Just you so far. Games need at least one friend.</p> : null}
        </section>
        <Library />
      </div>
    </div>
  );
}
