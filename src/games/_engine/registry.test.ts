import { describe, expect, it } from "vitest";
import { GAME_LOGIC } from "@/games/logic";
import { GAMES } from "@/games/catalog";
import { HOUSE_RULES } from "@/games/houseRules";

const P = ["00000000-0000-4000-8000-00000000000a", "00000000-0000-4000-8000-00000000000b"] as const;

describe("game registry", () => {
  it("every playable game is in the catalog with a matching category", () => {
    for (const logic of Object.values(GAME_LOGIC)) {
      const meta = GAMES.find((g) => g.id === logic.id);
      expect(meta, logic.id).toBeDefined();
      expect(meta!.category).toBe(logic.category);
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
});