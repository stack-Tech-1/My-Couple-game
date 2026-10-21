export const PUSH_KINDS = ["invites", "turns", "messages", "daily", "nudges", "notes"] as const;
export type PushKind = (typeof PUSH_KINDS)[number];
export const PUSH_LABEL: Record<PushKind, { label: string; description: string }> = {
  invites: { label: "Game invites", description: "When your partner wants to play, or wants a rematch." },
  turns: { label: "Your turn", description: "When it's your move in a game you're both in." },
  messages: { label: "Chat messages", description: "New messages, voice notes and stickers." },
  daily: { label: "Daily Question", description: "When your partner has answered and it's your turn." },
  nudges: { label: "Thinking of you", description: "When your partner sends you a nudge." },
  notes: { label: "Love notes", description: "When a letter arrives for you." },
};
export type PushPrefs = Record<PushKind, boolean>;
