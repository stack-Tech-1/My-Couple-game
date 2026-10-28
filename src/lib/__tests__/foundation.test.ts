import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safeNext";
import { afterDarkOpen, effectiveMaxHeat } from "@/lib/room/afterDark";
import { inviteCodeInput, profileInput } from "@/lib/room/types";
import type { Member, RoomBundle } from "@/lib/room/types";
import { friendlyError } from "@/lib/errors";
import { CATEGORIES, GAMES } from "@/games/catalog";

describe("safeNext", () => {
  it("allows same-origin relative paths", () => {
    expect(safeNext("/join/ABC234")).toBe("/join/ABC234");
  });
  it.each(["https://evil.com", "//evil.com", "/\\evil.com", "", null, undefined, "room"])("rejects %s", (v) => {
    expect(safeNext(v)).toBe("/room");
  });
});

const member = (over: Partial<Member> = {}): Member => ({
  room_id: "r",
  user_id: "u",
  joined_at: "",
  theme: "day",
  sound_enabled: false,
  age_confirmed_at: null,
  spicy_opt_in: false,
  max_heat: 1,
  ...over,
});
const bundle = (me: Partial<Member>, partner: Partial<Member> | null, kind: "couple" | "friends" = "couple"): RoomBundle => {
  const meP = { profile: { id: "a", display_name: "A", avatar_key: "fig", avatar_hue: 1, onboarded_at: "" }, member: member(me) };
  const partnerP = partner ? { profile: { id: "b", display_name: "B", avatar_key: "fig", avatar_hue: 1, onboarded_at: "" }, member: member(partner) } : null;
  return {
    room: { id: "r", name: "x", kind, owner_id: "a", invite_code: null, created_by: null, paired_at: null, together_since: null, settings: {}, created_at: "" },
    me: meP,
    partner: partnerP,
    members: partnerP ? [meP, partnerP] : [meP],
    rooms: [],
    blocked: [],
  };
};

describe("after dark gate", () => {
  const yes = { spicy_opt_in: true, age_confirmed_at: "2026-01-01" };
  it("stays locked without a partner", () => expect(afterDarkOpen(bundle(yes, null))).toBe(false));
  it("stays locked if one partner hasn't opted in", () => expect(afterDarkOpen(bundle(yes, { age_confirmed_at: "2026-01-01" }))).toBe(false));
  it("stays locked if one partner hasn't confirmed age", () => expect(afterDarkOpen(bundle(yes, { spicy_opt_in: true }))).toBe(false));
  it("opens only when both have both keys", () => expect(afterDarkOpen(bundle(yes, yes))).toBe(true));
  it("never opens in a friend room", () => expect(afterDarkOpen(bundle(yes, yes, "friends"))).toBe(false));
  it("caps heat at the lower maximum", () => {
    expect(effectiveMaxHeat(bundle({ max_heat: 3 }, { max_heat: 2 }))).toBe(2);
    expect(effectiveMaxHeat(bundle({ max_heat: 1 }, { max_heat: 3 }))).toBe(1);
  });
});

describe("input validation", () => {
  it("normalises invite codes and rejects ambiguous characters", () => {
    expect(inviteCodeInput.parse(" abc234 ")).toBe("ABC234");
    expect(inviteCodeInput.safeParse("ABC10O").success).toBe(false);
  });
  it("requires a display name", () => {
    expect(profileInput.safeParse({ display_name: "  ", avatar_key: "fig", avatar_hue: 10 }).success).toBe(false);
    expect(profileInput.safeParse({ display_name: "Tolu", avatar_key: "fig", avatar_hue: 10 }).success).toBe(true);
  });
});

describe("errors and catalog", () => {
  it("maps known errors to human copy", () => {
    expect(friendlyError(new Error("room is full"))).toMatch(/full/);
    expect(friendlyError(new Error("already in a couple room"))).toMatch(/one at a time/);
    expect(friendlyError(new Error("friend room limit"))).toMatch(/five friend rooms/);
    expect(friendlyError(new Error("only the owner can do that"))).toMatch(/owner/);
    expect(friendlyError(new Error("???"))).toMatch(/sideways/);
  });
  it("ships all 38 games with unique ids in known categories", () => {
    expect(GAMES).toHaveLength(38);
    expect(new Set(GAMES.map((g) => g.id)).size).toBe(38);
    for (const g of GAMES) expect(CATEGORIES[g.category]).toBeDefined();
  });
});