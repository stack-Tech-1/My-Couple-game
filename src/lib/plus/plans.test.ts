import { describe, expect, it } from "vitest";
import { GAMES } from "@/games/catalog";
import { FREE_GAMES, PLANS, hasPlus, isPlusGame, naira } from "./plans";
import { emailKey } from "./emailKey";

describe("Amah Plus plans", () => {
  it("keeps exactly the agreed games free, and every free id is a real game", () => {
    expect([...FREE_GAMES].sort()).toEqual(["ayo", "box-am", "connect-four", "daily-question", "draughts", "how-well", "love-notes", "ludo", "memory-lane", "tic-tac-toe", "whot"]);
    for (const id of FREE_GAMES) expect(GAMES.some((g) => g.id === id)).toBe(true);
    expect(isPlusGame("chess")).toBe(true);
    expect(isPlusGame("naija-landlord")).toBe(true);
    expect(isPlusGame("truth-or-dare")).toBe(true);
    expect(isPlusGame("whot")).toBe(false);
  });

  it("has the agreed prices", () => {
    expect(Object.fromEntries(Object.entries(PLANS).map(([k, p]) => [k, [p.seats, p.month, p.year]]))).toEqual({
      single: [1, 1500, 14750],
      couple: [2, 3000, 29500],
      group3: [3, 4000, 39000],
      group5: [5, 7000, 68500],
      group8: [8, 11000, 108750],
      gift: [1, 1500, 14750],
    });
    expect(naira(108750)).toBe("₦108,750");
  });

  it("treats everyone as Plus until it's live", () => {
    expect(hasPlus({ live: false, until: {}, trial: [], trialUsed: false }, "a")).toBe(true);
    expect(hasPlus({ live: true, until: { a: null }, trial: [], trialUsed: false }, "a")).toBe(false);
    expect(hasPlus({ live: true, until: { a: "2030-01-01" }, trial: [], trialUsed: false }, "a")).toBe(true);
  });

  it("counts the same inbox once for free trials", () => {
    const k = emailKey("ada.obi@gmail.com");
    expect(emailKey("AdaObi+amah@GoogleMail.com")).toBe(k);
    expect(emailKey(" a.d.a.o.b.i@gmail.com ")).toBe(k);
    // Other providers keep their dots, but still drop +tags.
    expect(emailKey("ada.obi@yahoo.com")).not.toBe(emailKey("adaobi@yahoo.com"));
    expect(emailKey("ada+x@yahoo.com")).toBe(emailKey("ada@yahoo.com"));
    expect(k).toMatch(/^[0-9a-f]{64}$/);
  });
});
