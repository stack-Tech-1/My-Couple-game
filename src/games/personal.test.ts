import { describe, expect, it } from "vitest";
import { runMove, MoveRejected } from "@/games/_engine/runner";
import { howWell, score } from "./how-well/logic";
import { thisOrThat, COUNT } from "./this-or-that/logic";
import { storyChain, MAX_LINES, MIN_LINES_TO_END } from "./story-chain/logic";
import { deepQuestions } from "./deep-questions/logic";
import { DEEP_QUESTIONS, DAILY_QUESTIONS, HOW_WELL, STORY_OPENERS, THIS_OR_THAT } from "@/content/personal";
import type { AnyGameLogic } from "./_engine/types";

const P = ["ada", "bo"] as const;
const ctx = { now: 0 };
const play = <S,>(g: AnyGameLogic, s: S, by: string, m: object) => runMove(g, s, m, by, ctx).next as S;

describe("personal content", () => {
  it("has enough of everything, with no duplicates", () => {
    expect(HOW_WELL.length).toBeGreaterThanOrEqual(30);
    expect(THIS_OR_THAT.length).toBeGreaterThanOrEqual(50);
    expect(STORY_OPENERS.length).toBeGreaterThanOrEqual(15);
    expect(DAILY_QUESTIONS.length).toBeGreaterThanOrEqual(90);
    expect(new Set(DAILY_QUESTIONS).size).toBe(DAILY_QUESTIONS.length);
    for (const l of DEEP_QUESTIONS) expect(l.questions.length).toBeGreaterThanOrEqual(12);
    for (const h of HOW_WELL) expect(new Set(h.options).size).toBe(4);
  });
});

describe("how well do you know me", () => {
  it("keeps answers hidden until both finish, then scores guesses against real answers", () => {
    let s = howWell.initialState("s", P, { count: 4 }, ctx);
    for (let i = 0; i < 4; i++) s = play(howWell, s, "ada", { index: i, self: 0, guess: 1 });
    const mid = howWell.viewFor(s, "bo");
    expect(mid.theirs).toBeNull();
    expect(mid.partnerProgress).toBe(4);
    for (let i = 0; i < 4; i++) s = play(howWell, s, "bo", { index: i, self: 1, guess: i < 3 ? 0 : 2 });
    // Ada guessed 1 every time; Bo answered 1 every time → 4. Bo guessed 0 three times; Ada answered 0 → 3.
    expect(howWell.viewFor(s, "ada").scores).toEqual({ ada: 4, bo: 3 });
    expect(howWell.isOver(s)).toEqual({ over: true, winner: "ada" });
    expect(score([{ self: 0, guess: 2 }], [{ self: 2, guess: 0 }])).toBe(1);
  });
  it("answers go in order", () => {
    const s = howWell.initialState("s", P, {}, ctx);
    expect(() => play(howWell, s, "ada", { index: 2, self: 0, guess: 0 })).toThrow(MoveRejected);
  });
});

describe("this or that", () => {
  it("completes when both finish and counts matches, skips never match", () => {
    let s = thisOrThat.initialState("s", P, {}, ctx);
    for (let i = 0; i < COUNT; i++) s = play(thisOrThat, s, "ada", { index: i, pick: i % 2 });
    expect(thisOrThat.viewFor(s, "bo").theirs).toBeNull();
    for (let i = 0; i < COUNT; i++) s = play(thisOrThat, s, "bo", { index: i, pick: i === 0 ? null : 1 });
    expect(thisOrThat.viewFor(s, "ada").matches).toBe(COUNT / 2);
    expect(thisOrThat.isOver(s)).toEqual({ over: true, complete: true });
  });
});

describe("story chain", () => {
  it("alternates lines and can only be ended after a few", () => {
    let s = storyChain.initialState("s", P, {}, ctx);
    const first = s.players[s.turn];
    const second = first === "ada" ? "bo" : "ada";
    expect(() => play(storyChain, s, second, { type: "line", text: "nope" })).toThrow(MoveRejected);
    expect(() => play(storyChain, s, first, { type: "end" })).toThrow(MoveRejected);
    for (let i = 0; i < MIN_LINES_TO_END; i++) s = play(storyChain, s, i % 2 ? second : first, { type: "line", text: `line ${i}` });
    s = play(storyChain, s, second, { type: "end", title: "The Goat Election" });
    expect(storyChain.isOver(s)).toEqual({ over: true, complete: true });
    expect(s.title).toBe("The Goat Election");
  });
  it("ends itself at the line limit", () => {
    let s = storyChain.initialState("s", P, {}, ctx);
    for (let i = 0; i < MAX_LINES; i++) s = play(storyChain, s, s.players[s.turn], { type: "line", text: `l${i}` });
    expect(s.ended).toBe(true);
  });
});

describe("deep questions", () => {
  it("deals a card, alternates who answers, skips without logging, and goes deeper on request", () => {
    let s = deepQuestions.initialState("s", P, {}, ctx);
    const v0 = deepQuestions.viewFor(s, "ada");
    expect(v0.card).toBeTruthy();
    expect(v0.level).toBe(0);
    const firstAnswerer = v0.answerer;
    s = play(deepQuestions, s, "ada", { type: "next" });
    expect(deepQuestions.viewFor(s, "ada").answerer).not.toBe(firstAnswerer);
    expect(s.asked).toHaveLength(1);
    s = play(deepQuestions, s, "bo", { type: "skip" });
    expect(s.asked).toHaveLength(1);
    s = play(deepQuestions, s, "bo", { type: "deeper" });
    s = play(deepQuestions, s, "bo", { type: "deeper" });
    expect(s.level).toBe(2);
    expect(() => play(deepQuestions, s, "bo", { type: "deeper" })).toThrow(MoveRejected);
    s = play(deepQuestions, s, "ada", { type: "end" });
    expect(deepQuestions.isOver(s)).toEqual({ over: true, complete: true });
  });
});