import { Avatar } from "@/design/Avatar";
import { supabaseAdmin } from "@/lib/supabase/server";
import { formatScore, soloGame } from "@/lib/solo/catalog";
import { roomBoard } from "@/lib/solo/server";
import type { RoomSummary } from "@/lib/room/types";

/** This week's best in each of my rooms (with at least two people), for one Solo game. */
export async function SoloBoards({ gameId, rooms, me }: { gameId: string; rooms: RoomSummary[]; me: string }) {
  const game = soloGame(gameId);
  const shared = rooms.filter((r) => r.members > 1).slice(0, 3);
  if (!game || game.kind === "bot" || !shared.length) return null;
  const admin = supabaseAdmin();
  const { data: members } = await admin.from("room_members").select("room_id, user_id").in("room_id", shared.map((r) => r.id));
  const ids = [...new Set((members ?? []).map((m) => m.user_id as string))];
  const { data: people } = await admin.from("profiles").select("id, display_name, avatar_key, avatar_hue").in("id", ids);
  const boards = await Promise.all(shared.map(async (r) => ({ room: r, rows: await roomBoard((members ?? []).filter((m) => m.room_id === r.id).map((m) => m.user_id as string), gameId) })));
  const person = (id: string) => (people ?? []).find((p) => p.id === id);
  const shown = boards.filter((b) => b.rows.length);
  if (!shown.length) return null;

  return (
    <section aria-labelledby="boards-h" className="mt-8">
      <h2 id="boards-h" className="display text-[1.4rem]">This week in your rooms</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {shown.map(({ room, rows }) => (
          <div key={room.id} className="glass rounded-[20px] p-4">
            <p className="font-bold">{room.kind === "couple" ? "You two" : room.name}</p>
            <ol className="mt-2 flex flex-col gap-1.5">
              {rows.map((r, i) => {
                const p = person(r.userId);
                return (
                  <li key={r.userId} className="flex items-center gap-2.5">
                    <span className="tabular w-4 text-right text-[0.82rem] text-muted">{i + 1}</span>
                    {p ? <Avatar name={p.display_name as string} motif={p.avatar_key as string} hue={p.avatar_hue as number} size={26} /> : null}
                    <span className="min-w-0 flex-1 truncate font-semibold">{r.userId === me ? "You" : ((p?.display_name as string) ?? "Someone")}</span>
                    <span className="tabular text-[0.88rem] font-bold">{formatScore(game, r.best)}</span>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[0.78rem] text-muted">Boards reset every Monday.</p>
    </section>
  );
}
