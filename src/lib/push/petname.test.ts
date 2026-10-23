import { describe, expect, it } from "vitest";
import { withPetName } from "./petname";

const p = { title: "Your move in Board games", body: "Bo just played. Tap to carry on.", url: "/room" };

describe("pet names in notifications", () => {
  it("swaps the whole name only", () => {
    expect(withPetName({ ...p, title: "Bo sent a note" }, "Bo", "Baby")).toMatchObject({ title: "Baby sent a note", body: "Baby just played. Tap to carry on." });
    expect(withPetName(p, "Bo", "Baby").title).toBe("Your move in Board games");
  });
  it("copes with names that look like patterns", () => {
    expect(withPetName({ ...p, body: "A.J. (the great) waved" }, "A.J. (the great)", "Love").body).toBe("Love waved");
  });
  it("leaves it alone without a pet name", () => {
    expect(withPetName(p, "Bo", undefined)).toBe(p);
  });
});
