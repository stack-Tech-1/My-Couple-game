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
  "spell-am": {
    key: "mode",
    options: [
      { value: "full", label: "Full game", hint: "No clock. Play until the bag runs out, live or through the day." },
      { value: "quick", label: "Quick", hint: "10 rounds, then the highest score wins." },
      { value: "live", label: "Live", hint: "2 minutes a turn, for when you're both here." },
    ],
  },
  ludo: {
    key: "twoDice",
    options: [
      { value: true, label: "Two dice", hint: "Use each die on a token, or add them up. A six on either die brings one out." },
      { value: false, label: "One die", hint: "The classic: one die, a six to come out." },
    ],
  },
};
