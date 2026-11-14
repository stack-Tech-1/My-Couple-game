import { describe, expect, it } from "vitest";
import { EMPTY_STATS } from "@/lib/progress/model";
import { PLACE_ITEMS, placeOf } from "./place";

describe("our place", () => {
  it("starts empty, and the next thing is the closest to done", () => {
    const p = placeOf(EMPTY_STATS);
    expect(p.have).toEqual([]);
    expect(p.next).not.toBeNull();
    const two = placeOf({ ...EMPTY_STATS, shared_days: 2 });
    expect(two.next!.item.id).toBe("sofa");
    expect(two.next!.left).toBe(1);
  });

  it("earns things from what they've done together", () => {
    const p = placeOf({ ...EMPTY_STATS, shared_days: 30, games: 26, memories: 1, notes: 2, best_streak: 31, messages: 10 });
    for (const id of ["sofa", "photo", "curtains", "rug", "table", "clock", "cushions", "plant_mid", "plant_big", "lights"]) expect(p.have).toContain(id);
    expect(p.have).not.toContain("lamp");
    expect(p.have).not.toContain("cat");
  });

  it("every item has a unique id and something to earn", () => {
    expect(new Set(PLACE_ITEMS.map((i) => i.id)).size).toBe(PLACE_ITEMS.length);
    for (const i of PLACE_ITEMS) expect(i.target).toBeGreaterThan(0);
  });
});
