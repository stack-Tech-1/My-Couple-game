import type { Poster } from "./model";
import type { PosterData } from "./styles";

/** The room's poster numbers, shaped for the four poster styles. */
export function posterDataFromRoom(p: Poster, year = new Date().getFullYear()): PosterData {
  const people = [p.me, ...(p.partner ? [p.partner] : [])].map((x) => ({ name: x.name, motif: x.motif, hue: x.hue }));
  const couple = !!p.partner;
  const stats = couple
    ? [
        ...(p.streak > 1 ? [{ value: String(p.streak), label: "days in a row" }] : []),
        { value: String(p.together), label: p.together === 1 ? "game together" : "games together" },
        ...(p.badges ? [{ value: `${p.badges.earned} of ${p.badges.total}`, label: "badges" }] : []),
      ]
    : [
        { value: String(p.played), label: p.played === 1 ? "game played" : "games played" },
        { value: String(p.wins), label: p.wins === 1 ? "win" : "wins" },
        ...(p.winRate !== null ? [{ value: `${p.winRate}%`, label: "win rate" }] : []),
      ];
  return {
    people,
    level: p.level ? { number: p.level.level, name: p.level.name } : null,
    headline: p.level ? null : p.played ? `${p.played} games on Amah` : "New on Amah",
    stats: stats.slice(0, 3),
    rivalry: couple && p.score && p.score[0] + p.score[1] > 0 ? { label: "Wins", scores: p.score } : null,
    game: p.topGame,
    year,
    photo: null,
    seed: people.map((x) => x.name).join("|"),
  };
}
