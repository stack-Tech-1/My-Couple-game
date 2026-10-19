import type { AnyGameLogic, MoveContext, Outcome, PlayerId, Players } from "./types";

export type DbOutcome = { status: "active" | "finished"; outcome: "win" | "tie" | "coop_win" | "coop_loss" | "complete" | null; winner: PlayerId | null };

export function toDb(o: Outcome): DbOutcome {
  if (!o.over) return { status: "active", outcome: null, winner: null };
  if ("complete" in o) return { status: "finished", outcome: "complete", winner: null };
  if ("coop" in o) return { status: "finished", outcome: o.coop === "win" ? "coop_win" : "coop_loss", winner: null };
  if (o.winner === "tie") return { status: "finished", outcome: "tie", winner: null };
  return { status: "finished", outcome: "win", winner: o.winner };
}

export function viewsFor(logic: AnyGameLogic, state: unknown, players: Players): Record<PlayerId, unknown> {
  return { [players[0]]: logic.viewFor(state, players[0]), [players[1]]: logic.viewFor(state, players[1]) };
}

export class MoveRejected extends Error {}

/**
 * Parse → validate → apply. Throws MoveRejected with a human message on any failure.
 * Everything here is pure; persistence is the caller's job.
 */
export function runMove(logic: AnyGameLogic, state: unknown, rawMove: unknown, by: PlayerId, ctx: MoveContext) {
  if (logic.isOver(state).over) throw new MoveRejected("This game is already over.");
  const parsed = logic.moveSchema.safeParse(rawMove);
  if (!parsed.success) throw new MoveRejected("That move didn't make sense to us.");
  if (!logic.validateMove(state, parsed.data, by, ctx)) throw new MoveRejected("That move isn't allowed right now.");
  const next = logic.applyMove(state, parsed.data, by, ctx);
  return { next, move: parsed.data as unknown, outcome: logic.isOver(next) };
}