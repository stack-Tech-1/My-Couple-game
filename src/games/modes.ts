/** Modes a player picks when starting a game. The value goes into the session config under `key`. */
export type GameMode = { key: string; options: { value: boolean | string | number; label: string; hint: string }[] };

export const GAME_MODES: Record<string, GameMode> = {
  whot: {
    key: "marketFinish",
    options: [
      { value: false, label: "Classic", hint: "First to empty their hand wins." },
      { value: true, label: "Market finish", hint: "The market refills once. When it runs out again, the lowest hand wins." },
    ],
  },
};
