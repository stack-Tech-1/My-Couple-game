import { z } from "zod";

/** Admin switches for the library: `off` games are hidden and can't be started; `new` ones wear a tag. */
export const gameFlagsSchema = z.object({
  off: z.array(z.string().max(40)).max(100).default([]),
  new: z.array(z.string().max(40)).max(100).default([]),
});
export type GameFlags = z.infer<typeof gameFlagsSchema>;
export const NO_FLAGS: GameFlags = { off: [], new: [] };

export function parseGameFlags(raw: unknown): GameFlags {
  const p = gameFlagsSchema.safeParse(raw);
  return p.success ? p.data : NO_FLAGS;
}
