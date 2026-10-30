"use server";

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUser } from "@/lib/room/server";
import { wordChecker } from "@/lib/games/dictionary";
import type { ActionResult } from "@/lib/room/types";
import { notify, displayName } from "@/lib/push/server";
import { lagosDay } from "./catalog";
import { markGuess, type Mark } from "./oro-words";
import { answerFor } from "./oro-days";

export type OroDuel = { name: string; solved: boolean; tries: number; marks: Mark[][] };
export type OroState = {
  day: string;
  naija: boolean;
  /** Fridays: a hint about the Naija word. */
  hint: string | null;
  guesses: string[];
  marks: Mark[][];
  solved: boolean;
  finished: boolean;
  /** Shown only once you've finished. */
  answer: string | null;
  /** Couples: your partner's result, once you've both finished (shapes only, never letters). */
  partner: OroDuel | null;
  /** Days in a row you've played. */
  streak: number;
};

async function partnerOf(userId: string): Promise<{ id: string; name: string } | null> {
  const admin = supabaseAdmin();
  const { data: mine } = await admin.from("room_members").select("room_id").eq("user_id", userId);
  const ids = (mine ?? []).map((m) => m.room_id as string);
  if (!ids.length) return null;
  const { data: couple } = await admin.from("rooms").select("id").in("id", ids).eq("kind", "couple").maybeSingle();
  if (!couple) return null;
  const { data: other } = await admin.from("room_members").select("user_id").eq("room_id", couple.id).neq("user_id", userId).maybeSingle();
  if (!other) return null;
  return { id: other.user_id as string, name: await displayName(other.user_id as string) };
}

async function streakOf(userId: string, today: string): Promise<number> {
  const { data } = await supabaseAdmin().from("solo_word_plays").select("day").eq("user_id", userId).not("finished_at", "is", null).order("day", { ascending: false }).limit(400);
  let n = 0;
  let expect = today;
  for (const r of data ?? []) {
    const d = r.day as string;
    if (d === expect) {
      n++;
      expect = new Date(Date.parse(`${expect}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
    } else if (n === 0 && d === new Date(Date.parse(`${today}T00:00:00Z`) - 864e5).toISOString().slice(0, 10)) {
      // Today not played yet: the streak still counts up to yesterday.
      n = 1;
      expect = new Date(Date.parse(`${d}T00:00:00Z`) - 864e5).toISOString().slice(0, 10);
    } else break;
  }
  return n;
}

async function stateFor(userId: string): Promise<OroState> {
  const day = lagosDay();
  const { word, naija, hint } = await answerFor(day);
  const admin = supabaseAdmin();
  const { data: row } = await admin.from("solo_word_plays").select("*").eq("user_id", userId).eq("day", day).maybeSingle();
  const guesses = (row?.guesses as string[] | undefined) ?? [];
  const marks = ((row?.marks as string[] | undefined) ?? []).map((m) => m.split(",") as Mark[]);
  const finished = !!row?.finished_at;
  let partner: OroDuel | null = null;
  if (finished) {
    const p = await partnerOf(userId);
    if (p) {
      const { data: theirs } = await admin.from("solo_word_plays").select("marks, solved, finished_at").eq("user_id", p.id).eq("day", day).maybeSingle();
      if (theirs?.finished_at) partner = { name: p.name, solved: !!theirs.solved, tries: (theirs.marks as string[]).length, marks: (theirs.marks as string[]).map((m) => m.split(",") as Mark[]) };
    }
  }
  return { day, naija, hint: naija ? hint : null, guesses, marks, solved: !!row?.solved, finished, answer: finished ? word : null, partner, streak: await streakOf(userId, day) };
}

export async function getOro(): Promise<ActionResult<OroState>> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in to play." };
  return { ok: true, data: await stateFor(user.id) };
}

/** One guess. Judged here, so the answer never reaches the phone before you finish. */
export async function guessOro(raw: unknown): Promise<ActionResult<OroState>> {
  const g = z.string().trim().toLowerCase().regex(/^[a-z]{5}$/).safeParse(raw);
  if (!g.success) return { ok: false, error: "Five letters, please." };
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in to play." };
  const admin = supabaseAdmin();
  const { data: ok } = await admin.rpc("server_rate_limit", { uid: user.id, action: "oro_guess", max_hits: 40, window_seconds: 600 });
  if (ok !== true) return { ok: false, error: "Easy, tiger. Give it a minute and try again." };
  const day = lagosDay();
  const { word } = await answerFor(day);
  const isWord = await wordChecker();
  if (!isWord(g.data) && g.data !== word) return { ok: false, error: `${g.data.toUpperCase()} isn't in our word list.` };

  const { data: row } = await admin.from("solo_word_plays").select("*").eq("user_id", user.id).eq("day", day).maybeSingle();
  if (row?.finished_at) return { ok: true, data: await stateFor(user.id) };
  const guesses = [...((row?.guesses as string[] | undefined) ?? []), g.data];
  const marks = [...((row?.marks as string[] | undefined) ?? []), markGuess(g.data, word).join(",")];
  const solved = g.data === word;
  const finished = solved || guesses.length >= 6;
  const { error } = await admin.from("solo_word_plays").upsert({
    user_id: user.id,
    day,
    guesses,
    marks,
    solved,
    finished_at: finished ? new Date().toISOString() : null,
  });
  if (error) return { ok: false, error: "Couldn't save that guess. Try again?" };

  if (finished) {
    // A score for bests and boards: tries taken, or 7 if not solved.
    await admin.from("solo_scores").insert({ user_id: user.id, game_id: "oro", mode: "daily", seed: day, score: solved ? guesses.length : 7, duration_ms: Math.max(0, Date.now() - Date.parse((row?.started_at as string) ?? new Date().toISOString())) });
    const p = await partnerOf(user.id);
    if (p) {
      const { data: theirs } = await admin.from("solo_word_plays").select("finished_at").eq("user_id", p.id).eq("day", day).maybeSingle();
      // Nudge the partner once a day, only if they haven't played yet.
      if (!theirs?.finished_at) {
        const me = await displayName(user.id);
        await notify(p.id, "daily", { title: "Today's word is up", body: `${me} has already played. Your turn.`, url: "/solo/oro", tag: `oro-${day}` });
      }
    }
  }
  return { ok: true, data: await stateFor(user.id) };
}
