import { describe, expect, it } from "vitest";
import { SURPRISE_ODDS, surpriseFor } from "./surprise";

describe("rare surprises", () => {
  it("about one finished game in thirty turns one up, the same answer every time", () => {
    const ids = Array.from({ length: 30_000 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    const hits = ids.filter((id) => surpriseFor(id, "whot") !== null).length;
    expect(hits / ids.length).toBeGreaterThan(1 / SURPRISE_ODDS / 1.5);
    expect(hits / ids.length).toBeLessThan((1 / SURPRISE_ODDS) * 1.5);
    const one = ids.find((id) => surpriseFor(id, "whot"))!;
    expect(surpriseFor(one, "whot")).toBe(surpriseFor(one, "whot"));
    expect(typeof surpriseFor(one, "chess")).toBe("string");
  });
});
