import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { gameMeta } from "./catalog";
import { GAME_TOURS, TIMED_TOURS } from "./tours";
import { GAME_LOGIC } from "./logic";

/** Every board's source, to check tour targets against. */
function sources(dir: string): string {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .map((e) => (e.isDirectory() ? sources(path.join(dir, e.name)) : e.name.endsWith(".tsx") ? fs.readFileSync(path.join(dir, e.name), "utf8") : ""))
    .join("\n");
}

describe("game tours", () => {
  const boards = sources(path.join(__dirname));

  it("every playable game has one (a new game needs a tour too)", () => {
    for (const id of Object.keys(GAME_LOGIC)) expect(GAME_TOURS[id], id).toBeDefined();
  });

  it("belong to real games and say something", () => {
    for (const [id, steps] of Object.entries(GAME_TOURS)) {
      expect(gameMeta(id), id).toBeDefined();
      expect(steps.length, id).toBeGreaterThanOrEqual(2);
      for (const s of steps) expect(s.title && s.body.length, `${id}: ${s.title}`).toBeTruthy();
    }
  });

  it("point only at things that exist on a board", () => {
    for (const [id, steps] of Object.entries(GAME_TOURS)) {
      for (const s of steps) if (s.target) expect(boards, `${id} → ${s.target}`).toContain(`data-tour="${s.target}"`);
    }
  });

  it("timed games' tours are shown before the board, so they point at nothing", () => {
    for (const id of TIMED_TOURS) {
      expect(GAME_TOURS[id], id).toBeDefined();
      expect(GAME_TOURS[id]!.every((s) => !s.target), id).toBe(true);
    }
  });
});
