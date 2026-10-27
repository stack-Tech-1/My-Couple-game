import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { AVATAR_MOTIFS, type AvatarMotif } from "@/design/Avatar";
import { BrandMarkImage } from "@/lib/brandMark";
import { scoreboard } from "@/lib/games/server";
import { buildPoster, scoreLine, type Poster, type PosterPerson } from "@/lib/poster/model";
import { getProgress } from "@/lib/progress/server";
import { getRoom } from "@/lib/room/server";
import { personalStats, type GameRow } from "@/lib/stats/personal";
import { supabaseAdmin, supabaseServer } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const BG = "#f6efe6";
const INK = "#1c1416";
const MUTED = "#6b5a5c";
const ACCENT = "#e8563a";
const CARD = "#fffaf3";

let fonts: Promise<{ name: string; data: Buffer; weight: 600 | 800; style: "normal" }[]> | null = null;
const loadFonts = () =>
  (fonts ??= Promise.all([
    readFile(join(process.cwd(), "assets/fonts/Fraunces-SemiBold.ttf")).then((data) => ({ name: "Fraunces", data, weight: 600 as const, style: "normal" as const })),
    readFile(join(process.cwd(), "assets/fonts/Manrope-SemiBold.ttf")).then((data) => ({ name: "Manrope", data, weight: 600 as const, style: "normal" as const })),
    readFile(join(process.cwd(), "assets/fonts/Manrope-ExtraBold.ttf")).then((data) => ({ name: "Manrope", data, weight: 800 as const, style: "normal" as const })),
  ]));

/** A 1080×1920 poster (WhatsApp Status size) of your Amah: level, streak, score, with the link. */
export async function GET(_req: Request, { params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const bundle = await getRoom(roomId);
  if (!bundle) return new Response("Not found", { status: 404 });
  const me = bundle.me.profile;
  // Drawing images costs real CPU: a sensible cap per person.
  const { data: allowed } = await supabaseAdmin().rpc("server_rate_limit", { uid: me.id, action: "poster", max_hits: 30, window_seconds: 3600 });
  if (allowed === false) return new Response("Too many posters. Try again in a bit.", { status: 429 });

  const partnerProfile = bundle.room.kind === "friends" ? null : (bundle.partner?.profile ?? null);
  const supabase = await supabaseServer();
  const [{ data: rows }, progress, board] = await Promise.all([
    supabase.from("game_sessions").select("game_id, players, status, outcome, winner, finished_at").contains("players", [me.id]).eq("status", "finished"),
    partnerProfile ? getProgress(roomId) : Promise.resolve(null),
    partnerProfile ? scoreboard(roomId) : Promise.resolve(null),
  ]);
  // Real names only: a pet name is private, and this is going on someone's status.
  const person = (p: { display_name: string; real_name?: string; avatar_key: string | null; avatar_hue: number | null }): PosterPerson => ({
    name: (p.real_name ?? p.display_name) || "Me",
    motif: p.avatar_key ?? "fig",
    hue: p.avatar_hue ?? 12,
  });
  const poster = buildPoster({
    me: person(me),
    partner: partnerProfile ? person(partnerProfile) : null,
    progress,
    score: partnerProfile && board ? [board.totals[me.id] ?? 0, board.totals[partnerProfile.id] ?? 0] : null,
    personal: personalStats(me.id, (rows ?? []) as GameRow[]),
  });

  return new ImageResponse(<PosterArt p={poster} />, {
    width: 1080,
    height: 1920,
    fonts: await loadFonts(),
    headers: { "Cache-Control": "private, no-store" },
  });
}

function Face({ who, size }: { who: PosterPerson; size: number }) {
  const path = AVATAR_MOTIFS[(who.motif in AVATAR_MOTIFS ? who.motif : "fig") as AvatarMotif];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size,
        background: `hsl(${who.hue}, 52%, 86%)`,
        border: `6px solid hsl(${who.hue}, 40%, 28%)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={size * 0.58} height={size * 0.58} viewBox="0 0 24 24" fill="none" stroke={`hsl(${who.hue}, 45%, 24%)`} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
        <path d={path} />
      </svg>
    </div>
  );
}

function Tile({ value, label, first }: { value: string | number; label: string; first?: boolean }) {
  return (
    <div style={{ width: 284, marginLeft: first ? 0 : 26, display: "flex", flexDirection: "column", background: CARD, border: `4px solid ${INK}`, borderRadius: 40, padding: "34px 30px" }}>
      <span style={{ fontFamily: "Fraunces", fontSize: 88, lineHeight: 1, color: INK, letterSpacing: -1 }}>{String(value)}</span>
      <span style={{ fontSize: 30, marginTop: 14, color: MUTED }}>{label}</span>
    </div>
  );
}

function PosterArt({ p }: { p: Poster }) {
  const couple = !!p.partner;
  const names = couple ? `${p.me.name} & ${p.partner!.name}` : p.me.name;
  const nameSize = names.length <= 12 ? 136 : names.length <= 20 ? 108 : names.length <= 28 ? 86 : 68;
  const line = scoreLine(p);
  const extras = [p.badges ? `${p.badges.earned} of ${p.badges.total} badges` : null, p.topGame ? `Favourite: ${p.topGame}` : null].filter(Boolean).join("   ·   ");

  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", background: BG, color: INK, fontFamily: "Manrope", fontWeight: 600 }}>
      <div style={{ display: "flex", flexDirection: "column", flex: 1, padding: "96px 88px 0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
            <BrandMarkImage size={84} />
            <span style={{ fontSize: 52, fontWeight: 800, letterSpacing: -1.5 }}>amah</span>
          </div>
          <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: 5, color: MUTED }}>{couple ? "OUR AMAH" : "MY AMAH"}</span>
        </div>

        <div style={{ display: "flex", marginTop: 110 }}>
          <Face who={p.me} size={168} />
          {p.partner ? (
            <div style={{ display: "flex", marginLeft: -40 }}>
              <Face who={p.partner} size={168} />
            </div>
          ) : null}
        </div>
        <span style={{ fontFamily: "Fraunces", fontSize: nameSize, lineHeight: 1.02, letterSpacing: -2, marginTop: 40 }}>{names}</span>

        {couple && p.level ? (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 64, background: INK, color: BG, borderRadius: 48, padding: "52px 56px" }}>
            <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: 5, color: ACCENT }}>LEVEL {p.level.level}</span>
            <span style={{ fontFamily: "Fraunces", fontSize: 112, lineHeight: 1.05, letterSpacing: -1.5, marginTop: 6 }}>{p.level.name}</span>
            <div style={{ display: "flex", height: 26, borderRadius: 26, background: "#3a2e30", marginTop: 34 }}>
              <div style={{ display: "flex", width: `${Math.max(4, Math.round(p.level.progress * 100))}%`, height: 26, borderRadius: 26, background: ACCENT }} />
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", marginTop: 64, background: INK, color: BG, borderRadius: 48, padding: "52px 56px" }}>
            <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: 5, color: ACCENT }}>GAMES PLAYED</span>
            <span style={{ fontFamily: "Fraunces", fontSize: 168, lineHeight: 1, letterSpacing: -4, marginTop: 10 }}>{String(p.played)}</span>
          </div>
        )}

        <div style={{ display: "flex", marginTop: 28 }}>
          {couple ? (
            <>
              {p.streak > 0 ? <Tile first value={p.streak} label="day streak" /> : <Tile first value={p.bestStreakDays} label="best day streak" />}
              <Tile value={p.score ? `${p.score[0]}–${p.score[1]}` : "0–0"} label="head to head" />
              <Tile value={p.together} label="games together" />
            </>
          ) : (
            <>
              <Tile first value={p.wins} label="wins" />
              <Tile value={p.winRate === null ? "–" : `${p.winRate}%`} label="win rate" />
              <Tile value={p.bestStreak} label="best win streak" />
            </>
          )}
        </div>

        {line ? <span style={{ fontSize: 36, marginTop: 40, color: INK }}>{line}</span> : null}
        {extras ? <span style={{ fontSize: 32, marginTop: line ? 14 : 40, color: MUTED }}>{extras}</span> : null}
      </div>

      <div style={{ display: "flex", flexDirection: "column", background: ACCENT, color: INK, padding: "60px 88px 72px" }}>
        <span style={{ fontFamily: "Fraunces", fontSize: 56, lineHeight: 1.1, letterSpacing: -0.5 }}>Game night for two, or the whole squad.</span>
        <span style={{ fontSize: 68, fontWeight: 800, letterSpacing: -1.5, marginTop: 18 }}>playamah.app</span>
      </div>
    </div>
  );
}
