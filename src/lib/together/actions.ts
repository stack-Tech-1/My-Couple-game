"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { challengeById } from "@/content/challenges";
import { friendlyError } from "@/lib/errors";
import { notifyPartner } from "@/lib/push/server";
import { getMyRoom } from "@/lib/room/server";
import type { ActionResult } from "@/lib/room/types";
import { supabaseServer } from "@/lib/supabase/server";
import { MOODS } from "./types";

const fail = (e: unknown): { ok: false; error: string } => ({ ok: false, error: friendlyError(e) });
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((s) => !Number.isNaN(Date.parse(s)), "That date doesn't exist.");

async function room() {
  const bundle = await getMyRoom();
  if (!bundle) throw new Error("not signed in");
  return { bundle, roomId: bundle.room.id, me: bundle.me.profile.id, supabase: await supabaseServer() };
}
const done = (roomId: string): ActionResult => {
  revalidatePath(`/room/${roomId}`, "layout");
  return { ok: true, data: null };
};

export async function setTogetherSince(date: unknown): Promise<ActionResult> {
  try {
    const { roomId, supabase } = await room();
    const value = date === null || date === "" ? null : isoDate.parse(date);
    if (value && Date.parse(value) > Date.now()) return { ok: false, error: "That's in the future. When did it start?" };
    const { error } = await supabase.from("rooms").update({ together_since: value }).eq("id", roomId);
    return error ? fail(error) : done(roomId);
  } catch (e) {
    return fail(e);
  }
}

export async function addCountdown(title: unknown, date: unknown): Promise<ActionResult> {
  try {
    const t = z.string().trim().min(1, "Give it a name.").max(60, "Keep it under 60 characters.").safeParse(title);
    if (!t.success) return { ok: false, error: t.error.issues[0]!.message };
    const d = isoDate.safeParse(date);
    if (!d.success) return { ok: false, error: "Pick a date." };
    if (Date.parse(d.data) < Date.now() - 86_400_000) return { ok: false, error: "Pick a date that hasn't passed yet." };
    const { roomId, me, supabase } = await room();
    const { error } = await supabase.from("countdowns").insert({ room_id: roomId, title: t.data, on_date: d.data, created_by: me });
    return error ? fail(error) : done(roomId);
  } catch (e) {
    return fail(e);
  }
}

export async function removeCountdown(id: unknown): Promise<ActionResult> {
  try {
    const { roomId, supabase } = await room();
    const { error } = await supabase.from("countdowns").delete().eq("id", z.uuid().parse(id)).eq("room_id", roomId);
    return error ? fail(error) : done(roomId);
  } catch (e) {
    return fail(e);
  }
}

export async function setMood(mood: unknown, note: unknown): Promise<ActionResult> {
  try {
    const m = z.enum(MOODS.map((x) => x.key) as [string, ...string[]]).safeParse(mood);
    if (!m.success) return { ok: false, error: "Pick a mood." };
    const n = z.string().trim().max(140, "Keep it under 140 characters.").safeParse(note ?? "");
    if (!n.success) return { ok: false, error: n.error.issues[0]!.message };
    const { bundle, roomId, me, supabase } = await room();
    const { error } = await supabase
      .from("moods")
      .upsert({ room_id: roomId, user_id: me, day: new Date().toISOString().slice(0, 10), mood: m.data, note: n.data || null, updated_at: new Date().toISOString() });
    if (error) return fail(error);
    if (m.data === "missing_you" || m.data === "sad") {
      const name = bundle.me.profile.display_name || "Your partner";
      after(() =>
        notifyPartner(roomId, me, "nudges", {
          title: m.data === "missing_you" ? `${name} is missing you` : `${name} is feeling low today`,
          body: m.data === "missing_you" ? "Maybe send a voice note?" : "A kind word might help.",
          url: `/room/${roomId}`,
          tag: `mood-${roomId}`,
        }),
      );
    }
    return done(roomId);
  } catch (e) {
    return fail(e);
  }
}

export async function startChallenge(challengeId: unknown): Promise<ActionResult> {
  try {
    if (typeof challengeId !== "string" || !challengeById(challengeId)) return { ok: false, error: "Pick a challenge." };
    const { roomId, me, supabase } = await room();
    const { error } = await supabase.from("room_challenges").insert({ room_id: roomId, challenge_id: challengeId, started_by: me });
    if (error) return error.code === "23505" ? { ok: false, error: "You already have a challenge running." } : fail(error);
    return done(roomId);
  } catch (e) {
    return fail(e);
  }
}

export async function endChallenge(id: unknown): Promise<ActionResult> {
  try {
    const { roomId, supabase } = await room();
    const { error } = await supabase.from("room_challenges").update({ ended_at: new Date().toISOString() }).eq("id", z.uuid().parse(id)).eq("room_id", roomId);
    return error ? fail(error) : done(roomId);
  } catch (e) {
    return fail(e);
  }
}

export async function tickChallenge(id: unknown, day: unknown, on: unknown): Promise<ActionResult> {
  try {
    const cid = z.uuid().parse(id);
    const d = z.number().int().min(1).max(30).parse(day);
    const { roomId, me, supabase } = await room();
    const { error } = on === true
      ? await supabase.from("challenge_checks").insert({ room_challenge_id: cid, day: d, user_id: me })
      : await supabase.from("challenge_checks").delete().eq("room_challenge_id", cid).eq("day", d).eq("user_id", me);
    if (error && error.code !== "23505") return error.code === "42501" ? { ok: false, error: "That day hasn't unlocked yet." } : fail(error);
    return done(roomId);
  } catch (e) {
    return fail(e);
  }
}
