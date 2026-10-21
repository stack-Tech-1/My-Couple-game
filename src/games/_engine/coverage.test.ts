import { describe, expect, it } from "vitest";
import { GAMES } from "@/games/catalog";
import { GAME_LOGIC } from "@/games/logic";

// Room features rendered by FeaturePage / FantasyMatch rather than turn-based sessions.
const FEATURES = ["daily-question", "love-notes", "memory-lane", "date-night", "bucket-list", "fantasy-match"];

describe("library coverage", () => {
  it("every catalogued game is playable: a session game or a room feature, never a stub", () => {
    for (const g of GAMES) expect(!!GAME_LOGIC[g.id] || FEATURES.includes(g.id), g.id).toBe(true);
    expect(GAMES).toHaveLength(31);
  });
});