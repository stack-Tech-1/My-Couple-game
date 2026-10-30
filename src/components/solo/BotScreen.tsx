"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { GAME_LOGIC } from "@/games/logic";
import { gameComponent } from "@/games/registry";
import { MoveRejected, runMove } from "@/games/_engine/runner";
import type { PlayerId } from "@/games/_engine/types";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { BOT_LEVELS, soloGame, type BotLevel } from "@/lib/solo/catalog";
import { BOT_ID, botMove, type BotBase } from "@/lib/solo/bots";
import { SoloShell, type SoloApi } from "./SoloShell";

// Each game types its own saved state; the frame just stores it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- boundary between the shared frame and each game
type AnySaved = any;

const ME = "me";

/** Pick a level, then play the real board against the bot. Bot games never count with people. */
export function BotScreen({ gameId, base, myName, soundOn, toured }: { gameId: string; base: string; myName: string; soundOn: boolean; toured: boolean }) {
  const game = soloGame(gameId)!;
  const [level, setLevel] = useState<BotLevel | null>(null);
  if (!level)
    return (
      <div>
        <h1 className="display mt-5 text-[2.2rem] leading-none">{game.name}</h1>
        <p className="mt-1.5 text-muted">{game.tagline}</p>
        <div role="radiogroup" aria-label="How good should the bot be?" className="mt-6 flex flex-col gap-2.5">
          {BOT_LEVELS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={false} onClick={() => setLevel(l.id)} className="glass flex items-center justify-between rounded-[18px] px-5 py-4 text-left">
              <span>
                <span className="block text-[1.1rem] font-extrabold">{l.label}</span>
                <span className="text-[0.85rem] text-muted">{l.id === "easy" ? "Plays at random. Good for learning." : l.id === "medium" ? "Thinks one move ahead." : "Thinks hard. Bring your A game."}</span>
              </span>
              <span aria-hidden className="text-[1.3rem]">→</span>
            </button>
          ))}
        </div>
        <p className="mt-4 text-[0.82rem] text-muted">Games against the bot never count towards your scores, wins or levels with people.</p>
      </div>
    );
  return (
    <SoloShell<AnySaved> key={level} gameId={gameId} mode={level} myName={myName} soundOn={soundOn} toured={toured} header={<p className="mt-4 font-semibold">{game.name} vs the bot ({BOT_LEVELS.find((l) => l.id === level)!.label})</p>}>
      {(api) => <BotGame api={api} base={base as BotBase} level={level} myName={myName} />}
    </SoloShell>
  );
}

function BotGame({ api, base, level, myName }: { api: SoloApi<unknown>; base: BotBase; level: BotLevel; myName: string }) {
  const logic = GAME_LOGIC[base]!;
  const Board = gameComponent(base)!;
  const players = useMemo(() => [ME, BOT_ID] as const, []);
  const [state, setState] = useState<unknown>(() => {
    if (api.saved) return api.saved;
    const config = logic.configSchema ? logic.configSchema.parse({}) : {};
    return logic.initialState(api.seed, players, config as never, { now: Date.now() });
  });
  const [pending, setPending] = useState(false);
  const ended = useRef(false);
  const names = useMemo<Record<PlayerId, string>>(() => ({ [ME]: myName, [BOT_ID]: `Bot (${BOT_LEVELS.find((l) => l.id === level)!.label})` }), [myName, level]);

  const apply = (move: unknown, by: PlayerId) => {
    const r = runMove(logic, state, move, by, { now: Date.now() });
    setState(r.next);
    return r;
  };

  // Save, finish, and let the bot move when it's its turn.
  useEffect(() => {
    api.save(state);
    const out = logic.isOver(state);
    if (out.over && !ended.current) {
      ended.current = true;
      const won = "winner" in out && out.winner === ME;
      api.sound(won ? "win" : "lose");
      api.end(won ? 1 : 0, { result: "winner" in out ? (out.winner === ME ? "won" : out.winner === "tie" ? "tie" : "lost") : "done" });
      return;
    }
    if (out.over || api.paused) return;
    const m = botMove(base, logic, state, BOT_ID, level, { now: Date.now() });
    if (m === null) return;
    const t = setTimeout(() => {
      try {
        apply(m, BOT_ID);
        api.sound("drop");
      } catch {
        // The position moved on (a timer ran out): the next render asks the bot again.
      }
    }, level === "hard" ? 900 : 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when the game state changes
  }, [state, api.paused]);

  return (
    <div className={cn("glass rounded-[24px] p-3 sm:p-5", api.paused && "pointer-events-none opacity-60")}>
      <Board
        view={logic.viewFor(state, ME)}
        me={ME}
        partner={BOT_ID}
        names={names}
        pending={pending}
        clock={() => Date.now()}
        broadcast={{ send: () => undefined, on: () => () => undefined }}
        sound={api.sound}
        sendMove={async (move, opts) => {
          setPending(true);
          try {
            apply(move, ME);
          } catch (e) {
            if (!opts?.silent) toast.error(e instanceof MoveRejected ? e.message : "That move didn't work.");
          } finally {
            setPending(false);
          }
        }}
      />
    </div>
  );
}
