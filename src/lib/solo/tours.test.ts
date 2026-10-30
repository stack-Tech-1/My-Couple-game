import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SOLO_GAMES } from "./catalog";
import { SOLO_TOURS, soloTourFor } from "./tours";

describe("solo tours", () => {
  const dir = path.join(__dirname, "../../components/solo");
  const src = [...fs.readdirSync(path.join(dir, "games")).map((f) => fs.readFileSync(path.join(dir, "games", f), "utf8"))].join("\n");

  it("every Solo game has one", () => {
    for (const g of SOLO_GAMES) expect(soloTourFor(g.id), g.id).toBeDefined();
  });

  it("points only at things that are on the board", () => {
    for (const [id, steps] of Object.entries(SOLO_TOURS))
      for (const s of steps) if (s.target) expect(src.includes(`data-tour="${s.target}"`), `${id}: ${s.target}`).toBe(true);
  });

  it("bot tours put the bot in your partner's seat", () => {
    for (const g of SOLO_GAMES.filter((x) => x.kind === "bot")) {
      const text = soloTourFor(g.id)!.flatMap((s) => s.body).join(" ");
      expect(text, g.id).not.toMatch(/your partner/i);
    }
  });
});
