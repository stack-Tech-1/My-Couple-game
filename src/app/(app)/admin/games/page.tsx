import { getGameFlags } from "@/lib/games/flags.server";
import { GameSwitches } from "@/components/admin/GameSwitches";

export default async function AdminGames() {
  const flags = await getGameFlags();
  return (
    <div className="max-w-3xl">
      <h1 className="display text-[2.6rem] leading-none">Games</h1>
      <p className="mt-2 text-[0.9rem] text-muted">
        Switch a game off to hide it from every library and stop new games of it starting (games already in progress can finish). Tag a game “New” to make it stand out. Changes apply on the next page load.
      </p>
      <GameSwitches initial={flags} />
    </div>
  );
}
