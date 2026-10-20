import { describe, expect, it } from "vitest";
import { countUnread, mergeMessages, type LocalMessage } from "./types";

const room = "00000000-0000-4000-8000-000000000000";
const me = "11111111-1111-4111-8111-111111111111";
const them = "22222222-2222-4222-8222-222222222222";
const msg = (id: string, at: string, sender = them, extra: Partial<LocalMessage> = {}): LocalMessage => ({
  id: `aaaaaaaa-aaaa-4aaa-8aaa-${id.padStart(12, "0")}`,
  room_id: room,
  sender_id: sender,
  body: `m${id}`,
  created_at: at,
  ...extra,
});

describe("mergeMessages", () => {
  it("dedupes by id and keeps time order across timestamp formats", () => {
    const a = msg("1", "2026-10-20T10:00:00.000Z");
    const b = msg("2", "2026-10-20T10:00:01.500+00:00");
    const c = msg("3", "2026-10-20T10:00:01Z");
    const out = mergeMessages([a, b], [c, a]);
    expect(out.map((m) => m.body)).toEqual(["m1", "m3", "m2"]);
  });

  it("lets the confirmed copy replace a pending one, never the reverse", () => {
    const pending = msg("1", "2026-10-20T10:00:00Z", me, { status: "sending" });
    const saved = msg("1", "2026-10-20T10:00:00.2+00:00", me);
    const once = mergeMessages([pending], [saved]);
    expect(once).toHaveLength(1);
    expect(once[0]!.status).toBeUndefined();
    expect(mergeMessages(once, [pending])[0]!.status).toBeUndefined();
  });
});

describe("countUnread", () => {
  const list = [msg("1", "2026-10-20T10:00:00Z"), msg("2", "2026-10-20T10:05:00Z", me), msg("3", "2026-10-20T10:06:00Z")];
  it("counts only the partner's messages after my read mark", () => {
    expect(countUnread(list, me, null)).toBe(2);
    expect(countUnread(list, me, "2026-10-20T10:01:00+00:00")).toBe(1);
    expect(countUnread(list, me, "2026-10-20T10:06:00Z")).toBe(0);
  });
});
