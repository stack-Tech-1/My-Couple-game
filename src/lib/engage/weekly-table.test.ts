import { describe, expect, it } from "vitest";
import { weeklyTable } from "./weekly-table";

describe("a friend room's weekly table", () => {
  it("scores 3 a win and 1 a game, and names each person's winning game", () => {
    const t = weeklyTable(
      [
        { players: ["a", "b"], winner: "a", game_id: "whot" },
        { players: ["a", "b", "c"], winner: "a", game_id: "whot" },
        { players: ["b", "c"], winner: "c", game_id: "ludo" },
        { players: ["b", "c"], winner: null, game_id: "chess" },
        { players: ["a", "x"], winner: "x", game_id: "ayo" }, // x left the room: not on the table
      ],
      ["a", "b", "c", "d"],
    );
    expect(t.map((r) => [r.userId, r.points, r.wins, r.played])).toEqual([
      ["a", 9, 2, 3],
      ["c", 6, 1, 3],
      ["b", 4, 0, 4],
      ["d", 0, 0, 0],
    ]);
    expect(t[0]!.topGame).toBe("whot");
    expect(t[2]!.topGame).toBeNull();
  });
});
