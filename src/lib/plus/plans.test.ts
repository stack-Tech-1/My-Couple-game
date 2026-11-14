import { describe, expect, it } from "vitest";
import { GAMES } from "@/games/catalog";
import { FREE_GAMES, FREE_MAX_PLAYERS, FREE_PLAYS_PER_DAY, PLANS, countsAsPlay, hasPlus, isPlusGame, lagosDayBounds, naira, untilText } from "./plans";
import { emailKey } from "./emailKey";
import { WEEKLY_ROTATION, freeGameOfWeek, isDailyMode, todaysGame } from "@/lib/engage/rotation";

describe("Amah Plus plans", () => {
  it("keeps exactly the agreed games free, and every free id is a real game", () => {
    expect([...FREE_GAMES].sort()).toEqual(["ayo", "box-am", "connect-four", "daily-question", "draughts", "how-well", "love-notes", "ludo", "memory-lane", "tic-tac-toe", "whot"]);
    for (const id of FREE_GAMES) expect(GAMES.some((g) => g.id === id)).toBe(true);
    // A fixed week, so the free game of the week doesn't make this depend on today's date.
    const at = Date.parse("2026-11-18T12:00:00Z");
    const free = freeGameOfWeek(at).gameId;
    expect(isPlusGame("chess", at)).toBe(true);
    expect(isPlusGame("truth-or-dare", at)).toBe(true);
    expect(isPlusGame("whot", at)).toBe(false);
    expect(isPlusGame(free, at)).toBe(false);
    for (const id of WEEKLY_ROTATION) if (id !== free) expect(isPlusGame(id, at)).toBe(true);
  });

  it("the free game of the week: a Plus game, never chess or After Dark, changing every Monday in Lagos", () => {
    for (const id of WEEKLY_ROTATION) {
      expect(GAMES.some((g) => g.id === id && g.category !== "spicy")).toBe(true);
      expect(FREE_GAMES.has(id)).toBe(false);
    }
    expect(WEEKLY_ROTATION).not.toContain("chess");
    // Sunday 23:30 Lagos and Monday 00:30 Lagos are different weeks.
    const sun = freeGameOfWeek(Date.parse("2026-11-15T22:30:00Z"));
    const mon = freeGameOfWeek(Date.parse("2026-11-15T23:30:00Z"));
    expect(sun.week).toBe("2026-11-09");
    expect(mon.week).toBe("2026-11-16");
    expect(sun.gameId).not.toBe(mon.gameId);
    expect(sun.endsAt).toBe("2026-11-15T23:00:00.000Z");
    // Today's game: the same for everyone all day, a new one tomorrow.
    const a = todaysGame(Date.parse("2026-11-14T00:30:00Z"));
    const b = todaysGame(Date.parse("2026-11-14T21:00:00Z"));
    expect(a).toEqual(b);
    expect(a.mode).toBe("d-20261114");
    expect(isDailyMode(a.mode)).toBe(true);
    expect(todaysGame(Date.parse("2026-11-15T12:00:00Z")).gameId).not.toBe(a.gameId);
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

  it("free plays: which games count, and the day runs Lagos midnight to midnight", () => {
    expect(FREE_PLAYS_PER_DAY).toBe(2);
    expect(FREE_MAX_PLAYERS).toBe(2);
    for (const id of ["whot", "ludo", "box-am", "how-well", "bot-whot", "mama-put", "fix-am"]) expect(countsAsPlay(id)).toBe(true);
    for (const id of ["daily-question", "love-notes", "memory-lane", "oro"]) expect(countsAsPlay(id)).toBe(false);
    // 23:30 Lagos on 13 Nov is 22:30 UTC: still the 13th, ending at 23:00 UTC.
    expect(lagosDayBounds(Date.parse("2026-11-13T22:30:00Z"))).toEqual({ start: "2026-11-12T23:00:00.000Z", end: "2026-11-13T23:00:00.000Z" });
    // 00:10 Lagos on the 14th is 23:10 UTC on the 13th: a new day.
    expect(lagosDayBounds(Date.parse("2026-11-13T23:10:00Z")).start).toBe("2026-11-13T23:00:00.000Z");
    const now = Date.parse("2026-11-13T18:00:00Z");
    expect(untilText("2026-11-13T23:00:00.000Z", now)).toBe("in 5h");
    expect(untilText("2026-11-13T23:00:00.000Z", Date.parse("2026-11-13T18:40:00Z"))).toBe("in 4h 20m");
    expect(untilText("2026-11-13T23:00:00.000Z", Date.parse("2026-11-13T22:48:00Z"))).toBe("in 12m");
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
