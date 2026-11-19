import { describe, expect, it } from "vitest";
import { SAVE_MS, keeperRank, savesOf } from "./reflex";

describe("Reflex Training as penalties", () => {
  it("counts a save under the line, not on it", () => {
    expect(savesOf([SAVE_MS - 1, SAVE_MS, 180, 420, 250])).toBe(3);
    expect(savesOf([])).toBe(0);
  });

  it("ranks by average time, edges going to the slower rank", () => {
    expect(keeperRank(229).name).toBe("Super Eagles keeper");
    expect(keeperRank(230).name).toBe("Club first choice");
    expect(keeperRank(279).name).toBe("Club first choice");
    expect(keeperRank(280).name).toBe("Bench keeper");
    expect(keeperRank(350).name).toBe("Street ball keeper");
  });
});
