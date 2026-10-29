import type { RoomBundle } from "@/lib/room/types";
import { GameArt } from "@/games/GameArt";
import { lookFor } from "@/games/look";
import { GAMES, type GameMeta } from "@/games/catalog";
import { AdireFill } from "@/design/adire";
import { FREE_GAMES } from "@/lib/plus/plans";
import { PlusPanel, PlusTag } from "./PlusTag";
import { PlusPlans } from "./PlusPlans";

/**
 * What someone without Plus sees on a Plus game: a friendly invitation, never a locked door.
 * The trial comes first if it's unused.
 */
export function PlusGate({ bundle, game }: { bundle: RoomBundle; game?: GameMeta }) {
  const look = game ? lookFor(game.id, game.category) : null;
  const paidCount = GAMES.length - FREE_GAMES.size;
  const couple = bundle.room.kind === "couple";
  return (
    <section aria-labelledby="plus-gate-h" className="overflow-hidden rounded-[28px] bg-bg shadow-[0_20px_40px_-26px_rgba(28,20,22,.7)]">
      <PlusPanel className="px-5 pb-6 pt-6 sm:px-7">
        <div className="flex items-center gap-4">
          {game && look ? (
            <div className="relative h-[76px] w-[76px] shrink-0 overflow-hidden rounded-[20px] shadow-[0_0_0_3px_#d9a43a]" style={{ color: "#1c1416", ["--bg-raised" as string]: "#fbf7f1" }}>
              <AdireFill motif={look.motif} bg={look.bg} ink={look.ink} />
              <GameArt id={game.id} accent={look.accent} className="relative mx-auto mt-2 h-[60px] w-auto" />
            </div>
          ) : null}
          <div>
            <PlusTag />
            <h2 id="plus-gate-h" className="display mt-1.5 text-[1.7rem] leading-[1.1]">
              {game ? `${game.name} is on Amah Plus` : "That's on Amah Plus"}
            </h2>
          </div>
        </div>
      </PlusPanel>
      <div className="px-5 pb-6 pt-4 sm:px-7">
        <p className="text-[0.9rem] leading-relaxed text-muted">
          Plus opens {paidCount} more games{couple ? " for both of you" : ""}, including {couple ? "After Dark, " : ""}Spell Am and Naija Landlord, plus voice notes and stickers.
        </p>
        <div className="mt-4">
          <PlusPlans roomId={bundle.room.id} roomKind={bundle.room.kind} partnerName={bundle.partner?.profile.display_name ?? null} trialAvailable={!bundle.plus.trialUsed} />
        </div>
      </div>
    </section>
  );
}
