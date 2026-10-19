import type { RoomBundle } from "./types";

/**
 * After Dark is visible only when the room is paired AND both members have
 * confirmed 18+ AND both have opted in. One missing key keeps it locked.
 * The database enforces the same rule; this is the UI mirror.
 */
export function afterDarkOpen(b: RoomBundle): boolean {
  const p = b.partner;
  if (!p) return false;
  const both = [b.me.member, p.member];
  return both.every((m) => m.spicy_opt_in && m.age_confirmed_at !== null);
}

/** Heat is always capped at the lower of the two players' chosen maximums. */
export function effectiveMaxHeat(b: RoomBundle): number {
  return Math.min(b.me.member.max_heat, b.partner?.member.max_heat ?? 1);
}