import { describe, expect, it } from "vitest";
import { GAME_LOGIC } from "@/games/logic";
import { FRIEND_GAMES, GAMES } from "@/games/catalog";
import { HOUSE_RULES } from "@/games/houseRules";

const P = ["00000000-0000-4000-8000-00000000000a", "00000000-0000-4000-8000-00000000000b"] as const;

describe("game registry", () => {
  it("every playable game is in the catalog with a matching category", () => {
    for (const logic of Object.values(GAME_LOGIC)) {
      const meta = GAMES.find((g) => g.id === logic.id);
      expect(meta, logic.id).toBeDefined();
      expect(meta!.category).toBe(logic.category);
      expect(meta!.maxPlayers ?? 2, logic.id).toBe(logic.maxPlayers);
      expect(meta!.minPlayers ?? 2, logic.id).toBe(logic.minPlayers);
      expect(logic.rules.sections.length).toBeGreaterThan(0);
    }
  });

  it("no game ever sends its RNG seed or cursor to a client", () => {
    for (const logic of Object.values(GAME_LOGIC)) {
      const s = logic.initialState("a-secret-seed", P, {}, { now: 0 });
      for (const p of P) {
        const json = JSON.stringify(logic.viewFor(s, p));
        expect(json, logic.id).not.toContain("a-secret-seed");
        expect(json, logic.id).not.toContain("rngCursor");
      }
    }
  });

  it("house-rule defaults parse for every game that has them", () => {
    for (const [id, def] of Object.entries(HOUSE_RULES)) {
      expect(GAME_LOGIC[id], id).toBeDefined();
      const parsed = def.schema.parse({});
      for (const f of def.fields) expect(parsed, `${id}.${f.key}`).toHaveProperty(f.key);
    }
  });

  it("spectators (friend-room members not playing) see only what an outsider may: no secrets, no crash", () => {
    const G = ["00000000-0000-4000-8000-00000000000a", "00000000-0000-4000-8000-00000000000b", "00000000-0000-4000-8000-00000000000c"] as const;
    const watcher = "00000000-0000-4000-8000-0000000000ff";
    for (const id of FRIEND_GAMES) {
      const logic = GAME_LOGIC[id]!;
      const players = logic.maxPlayers >= 3 ? G : G.slice(0, 2);
      const s = logic.initialState("a-secret-seed", players, {}, { now: 0 }) as Record<string, unknown>;
      const json = JSON.stringify(logic.viewFor(s, watcher));
      expect(json, id).not.toContain("a-secret-seed");
      expect(json, id).not.toContain("rngCursor");
      // Hidden things that exist at the start of these games.
      if (id === "whot") for (const p of players) for (const c of (s.hands as Record<string, { id: number }[]>)[p]!) expect(json).not.toContain(`"id":${c.id},`);
      if (id === "word-duel") expect(json).not.toContain(s.target as string);
      if (id === "riddles") expect(json).not.toContain(`"answer"`);
      if (id === "dont-laugh") expect((logic.viewFor(s, watcher) as { prompt: unknown }).prompt).toBeNull();
    }
  });
});
