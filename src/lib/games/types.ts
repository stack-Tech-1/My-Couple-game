import { z } from "zod";

export type SessionRow = {
  id: string;
  room_id: string;
  game_id: string;
  status: "active" | "finished" | "abandoned";
  players: [string, string];
  created_by: string | null;
  config: Record<string, unknown>;
  version: number;
  winner: string | null;
  outcome: "win" | "tie" | "coop_win" | "coop_loss" | "complete" | "abandoned" | null;
  rematch_of: string | null;
  created_at: string;
  finished_at: string | null;
};

/** serverNow lets clients estimate clock offset for timed games. */
export type SessionSnapshot = {
  session: SessionRow;
  view: unknown;
  version: number;
  serverNow?: number;
  /** After Dark only: a partner opted out; the current card finishes, then the session ends. */
  closing?: boolean;
};

export const createSessionBody = z.object({
  gameId: z.string().min(1).max(40),
  config: z.record(z.string(), z.unknown()).optional(),
  rematchOf: z.uuid().optional(),
  /** Which room to play in. Absent: your couple room. */
  roomId: z.uuid().optional(),
  /** Friend rooms: who you're playing (one friend, or several for group games). */
  opponent: z.uuid().optional(),
  opponents: z.array(z.uuid()).max(7).optional(),
});

export const moveBody = z.object({
  move: z.unknown(),
  expectedVersion: z.number().int().min(0).optional(),
});

/** Broadcast on the room channel to invite the partner into a session. */
export const inviteEvent = z.object({
  sessionId: z.uuid(),
  gameId: z.string().max(40),
  rematch: z.boolean().optional(),
  /** Friend rooms: who the invite is for. Absent in couple rooms (it's for your partner). */
  to: z.array(z.uuid()).max(8).optional(),
});
export type InviteEvent = z.infer<typeof inviteEvent>;