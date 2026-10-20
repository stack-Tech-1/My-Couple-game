import { describe, expect, it } from "vitest";
import { builtInKey, deck, KINDS, type Overrides } from "./catalog";
import { howWell } from "@/games/how-well/logic";
import { deepQuestions } from "@/games/deep-questions/logic";
import { thisOrThat } from "@/games/this-or-that/logic";
import { DAILY_QUESTIONS, HOW_WELL } from "@/content/personal";

const none: Overrides = { added: [], hidden: [] };
const t = (iso: string) => iso;

describe("content decks", () => {
  it("are the built-ins when nothing is changed", () => {
    expect(deck("daily_question", none).map((q) => q.text)).toEqual(DAILY_QUESTIONS);
  });

  it("add valid items, skip malformed ones, and hide built-ins by key", () => {
    const first = KINDS.daily_question.builtIn()[0]!;
    const o: Overrides = {
      added: [
        { id: "a1", kind: "daily_question", body: { text: "What song is ours?" }, created_at: t("2026-10-20T09:00:00Z") },
        { id: "a2", kind: "daily_question", body: { nope: true }, created_at: t("2026-10-20T09:00:00Z") },
      ],
      hidden: [{ kind: "daily_question", key: builtInKey("daily_question", first), created_at: t("2026-10-20T09:00:00Z") }],
    };
    const texts = deck("daily_question", o).map((q) => q.text);
    expect(texts).toContain("What song is ours?");
    expect(texts).not.toContain(first.text);
    expect(texts).toHaveLength(DAILY_QUESTIONS.length);
  });

  it("only apply changes made before `asOf` (Daily Questions change from the next day)", () => {
    const o: Overrides = { added: [{ id: "a1", kind: "daily_question", body: { text: "New one?" }, created_at: t("2026-10-21T08:00:00Z") }], hidden: [] };
    expect(deck("daily_question", o, Date.parse("2026-10-21T00:00:00Z")).map((q) => q.text)).not.toContain("New one?");
    expect(deck("daily_question", o, Date.parse("2026-10-22T00:00:00Z")).map((q) => q.text)).toContain("New one?");
  });

  it("never come back empty", () => {
    const all = KINDS.story_opener.builtIn().map((i) => ({ kind: "story_opener" as const, key: builtInKey("story_opener", i), created_at: t("2026-10-20T00:00:00Z") }));
    expect(deck("story_opener", { added: [], hidden: all }).length).toBe(KINDS.story_opener.builtIn().length);
  });

  it("give every built-in a distinct key", () => {
    for (const k of Object.keys(KINDS) as (keyof typeof KINDS)[]) {
      const items = (KINDS[k].builtIn as () => unknown[])();
      const keys = new Set(items.map((i) => builtInKey(k, i)));
      expect(keys.size, k).toBe(new Set(items.map((i) => JSON.stringify(i))).size);
    }
  });
});

describe("games draw from the content pack and keep what they drew", () => {
  const players = ["p1", "p2"] as [string, string];
  const custom = [{ q: "Only question?", options: ["A", "B", "C", "D"] as [string, string, string, string] }];

  it("How Well copies its questions into state", () => {
    const s = howWell.initialState("seed", players, { count: 6 }, { now: 0, content: { how_well: custom } });
    expect(s.items).toEqual([{ q: "Only question?", options: ["A", "B", "C", "D"] }]);
    expect(howWell.viewFor(s, "p1").questions[0]!.q).toBe("Only question?");
    // Without a pack (or a session from before), the built-ins are used.
    const legacy = { ...howWell.initialState("seed", players, { count: 6 }, { now: 0 }), items: undefined };
    expect(HOW_WELL.map((h) => h.q)).toContain(howWell.viewFor(legacy, "p1").questions[0]!.q);
  });

  it("This or That finishes on the number of pairs it actually drew", () => {
    const s0 = thisOrThat.initialState("seed", players, {} as never, { now: 0, content: { this_or_that: [{ a: "Tea", b: "Coffee" }] } });
    expect(thisOrThat.viewFor(s0, "p1").pairs).toEqual([["Tea", "Coffee"]]);
    const s1 = thisOrThat.applyMove(s0, { index: 0, pick: 0 }, "p1", { now: 0 });
    const s2 = thisOrThat.applyMove(s1, { index: 0, pick: 1 }, "p2", { now: 0 });
    expect(thisOrThat.isOver(s2).over).toBe(true);
  });

  it("Deep Questions uses pooled questions per level, falling back for empty levels", () => {
    const s = deepQuestions.initialState("seed", players, {} as never, { now: 0, content: { deep_question: [{ level: 0, text: "Our only warm-up?" }] } });
    expect(deepQuestions.viewFor(s, "p1").card).toBe("Our only warm-up?");
    expect(s.bank![1]!.length).toBeGreaterThan(1);
  });
});
