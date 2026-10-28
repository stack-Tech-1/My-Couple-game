/**
 * Library metadata for every game. The library UI, landing page and rules
 * screens read from here. Playable modules are registered separately in
 * `registry.ts`, keyed by the same id.
 */

export type GameCategory = "competitive" | "coop" | "personal" | "romantic" | "spicy";

export type CategoryInfo = {
  id: GameCategory;
  label: string;
  blurb: string;
  /** CSS variable names; fill colour and an AA-safe text colour */
  color: string;
  ink: string;
};

export const CATEGORIES: Record<GameCategory, CategoryInfo> = {
  competitive: {
    id: "competitive",
    label: "Head to head",
    blurb: "Somebody's sleeping on the couch. Metaphorically.",
    color: "var(--cat-competitive)",
    ink: "var(--cat-competitive-ink)",
  },
  coop: {
    id: "coop",
    label: "Same team",
    blurb: "Two brains, one shared problem. Try not to blame each other.",
    color: "var(--cat-coop)",
    ink: "var(--cat-coop-ink)",
  },
  personal: {
    id: "personal",
    label: "Getting to know you",
    blurb: "You think you know them. Let's find out.",
    color: "var(--cat-personal)",
    ink: "var(--cat-personal-ink)",
  },
  romantic: {
    id: "romantic",
    label: "Soft hours",
    blurb: "Notes, photos and plans. The keepsake drawer.",
    color: "var(--cat-romantic)",
    ink: "var(--cat-romantic-ink)",
  },
  spicy: {
    id: "spicy",
    label: "After dark",
    blurb: "Strictly 18+, strictly opt-in, strictly between you two.",
    color: "var(--cat-spicy)",
    ink: "var(--cat-spicy-ink)",
  },
};

export const CATEGORY_ORDER: GameCategory[] = ["competitive", "coop", "personal", "romantic", "spicy"];

export type GameMeta = {
  id: string;
  name: string;
  category: GameCategory;
  estimatedMinutes: number;
  tagline: string;
  /** Turn-based games are recorded to head-to-head. Keepsake activities aren't scored. */
  scored: boolean;
  /** Group games: how many can play in a friend room (must match the game logic). */
  minPlayers?: number;
  maxPlayers?: number;
  /** Only in friend rooms (it needs a group). */
  friendsOnly?: boolean;
};

export const GAMES: GameMeta[] = [
  // Competitive
  { id: "know-me-trivia", name: "Know Me Trivia", category: "competitive", estimatedMinutes: 10, scored: true, tagline: "Write questions about yourself. Watch them get it wrong." },
  { id: "whot", name: "Whot", category: "competitive", estimatedMinutes: 12, scored: true, maxPlayers: 4, tagline: "Pick two. Pick three. General market. No mercy." },
  { id: "ludo", name: "Ludo", category: "competitive", estimatedMinutes: 20, scored: true, maxPlayers: 4, tagline: "Roll a six and pretend you're not gloating." },
  { id: "ayo", name: "Ayo", category: "competitive", estimatedMinutes: 12, scored: true, tagline: "Sow, count, capture. The oldest trash talk there is." },
  { id: "word-duel", name: "Word Duel", category: "competitive", estimatedMinutes: 5, scored: true, maxPlayers: 8, tagline: "Same five letters. You only see their colours." },
  { id: "reflex-duel", name: "Reflex Duel", category: "competitive", estimatedMinutes: 3, scored: true, maxPlayers: 8, tagline: "Wait for it. Wait for it. Don't." },
  { id: "chess", name: "Chess", category: "competitive", estimatedMinutes: 20, scored: true, tagline: "The oldest grudge match there is. Take your time." },
  { id: "draughts", name: "Draughts", category: "competitive", estimatedMinutes: 20, scored: true, tagline: "Draft, the ten by ten way. Flying kings, compulsory captures." },
  { id: "tic-tac-toe", name: "X and O", category: "competitive", estimatedMinutes: 4, scored: true, tagline: "Tic-tac-toe, first to three. Quick, petty, perfect." },
  { id: "connect-four", name: "Connect Four", category: "competitive", estimatedMinutes: 6, scored: true, tagline: "Four in a row, and a lifetime of grudges." },
  { id: "draw-guess", name: "Draw & Guess", category: "competitive", estimatedMinutes: 10, scored: true, maxPlayers: 8, tagline: "It's a horse. Obviously it's a horse." },
  { id: "riddles", name: "Riddle Me This", category: "competitive", estimatedMinutes: 6, scored: true, maxPlayers: 8, tagline: "Simple words, twisted answers. Get your mind out of the gutter." },
  { id: "naija-trivia", name: "Naija Trivia", category: "competitive", estimatedMinutes: 6, scored: true, tagline: "Festivals, places, books and history. How Naija are you?" },
  { id: "pidgin-palava", name: "Pidgin Palava", category: "competitive", estimatedMinutes: 4, scored: true, tagline: "Wetin e mean? Prove say you sabi." },
  { id: "dont-laugh", name: "Don't Laugh", category: "competitive", estimatedMinutes: 8, scored: true, maxPlayers: 8, tagline: "Perform something ridiculous. They must keep a straight face." },
  { id: "emoji-guess", name: "Emoji Guess", category: "competitive", estimatedMinutes: 5, scored: true, tagline: "Afrobeats hits and Nollywood favourites, in emoji." },
  // Co-op
  { id: "split-clues", name: "Split Clues", category: "coop", estimatedMinutes: 15, scored: true, tagline: "You each hold half the answer. Talk it out." },
  { id: "in-sync", name: "In Sync", category: "coop", estimatedMinutes: 5, scored: true, tagline: "Say the same word at the same time. Eventually." },
  { id: "memory-match", name: "Memory Match Together", category: "coop", estimatedMinutes: 6, scored: true, tagline: "One board, two memories, a ticking clock." },
  { id: "beat-the-clock", name: "Beat the Clock", category: "coop", estimatedMinutes: 5, scored: true, tagline: "Quick little challenges. One shared score." },
  // Personal
  { id: "how-well", name: "How Well Do You Know Me", category: "personal", estimatedMinutes: 10, scored: true, tagline: "Answer for yourself, then guess for them." },
  { id: "daily-question", name: "Daily Question", category: "personal", estimatedMinutes: 2, scored: false, tagline: "One question a day. No peeking until you both answer." },
  { id: "story-chain", name: "Story Chain", category: "personal", estimatedMinutes: 10, scored: false, tagline: "A story, one line each. It will go off the rails." },
  { id: "this-or-that", name: "This or That", category: "personal", estimatedMinutes: 4, scored: false, tagline: "Rapid fire. Then see where you match." },
  { id: "love-styles", name: "Love Styles", category: "personal", estimatedMinutes: 5, scored: false, tagline: "How do you most like to be loved? Guess theirs too." },
  { id: "same-page", name: "On the Same Page", category: "personal", estimatedMinutes: 6, scored: false, tagline: "Money, family, children, December. Are you in step?" },
  { id: "most-likely", name: "Most Likely To", category: "personal", estimatedMinutes: 6, scored: false, minPlayers: 3, maxPlayers: 8, friendsOnly: true, tagline: "Who in this room is most likely to…? Anonymous votes, public shame." },
  { id: "deep-questions", name: "Deep Questions", category: "personal", estimatedMinutes: 20, scored: false, tagline: "Start easy. Go somewhere real." },
  // Romantic
  { id: "love-notes", name: "Love Notes", category: "romantic", estimatedMinutes: 5, scored: false, tagline: "Write a letter. Seal it until the right day." },
  { id: "memory-lane", name: "Memory Lane", category: "romantic", estimatedMinutes: 5, scored: false, tagline: "A photo, a question: where were we here?" },
  { id: "date-night", name: "Date Night Generator", category: "romantic", estimatedMinutes: 2, scored: false, tagline: "Spin it. Commit to it. No take-backs." },
  { id: "compliment-battle", name: "Compliment Battle", category: "romantic", estimatedMinutes: 6, scored: true, tagline: "Timed flattery. Hearts awarded by the judge." },
  { id: "bucket-list", name: "Our Bucket List", category: "romantic", estimatedMinutes: 3, scored: false, tagline: "Everything you said you'd do someday." },
  // Spicy
  { id: "truth-or-dare", name: "Truth or Dare: After Dark", category: "spicy", estimatedMinutes: 15, scored: false, tagline: "Warm, hot or fire. You set the ceiling." },
  { id: "spicy-dice", name: "Spicy Dice", category: "spicy", estimatedMinutes: 10, scored: false, tagline: "One die says what. The other says how." },
  { id: "hot-seat", name: "Hot Seat", category: "spicy", estimatedMinutes: 10, scored: false, tagline: "A run of flirty questions. Then swap chairs." },
  { id: "never-have-i", name: "Never Have I Ever: After Dark", category: "spicy", estimatedMinutes: 10, scored: false, tagline: "Confess or don't. Either way, they'll know." },
  { id: "fantasy-match", name: "Fantasy Match", category: "spicy", estimatedMinutes: 10, scored: false, tagline: "Only the mutual yeses ever see daylight." },
];

/** The games friend rooms get (for now, played one friend against another). */
export const FRIEND_GAMES = ["whot", "ludo", "ayo", "word-duel", "reflex-duel", "connect-four", "chess", "draughts", "tic-tac-toe", "draw-guess", "riddles", "dont-laugh", "most-likely"] as const;
export const isFriendGame = (id: string) => (FRIEND_GAMES as readonly string[]).includes(id);

export const gameMeta = (id: string): GameMeta | undefined => GAMES.find((g) => g.id === id);
export const gamesIn = (c: GameCategory): GameMeta[] => GAMES.filter((g) => g.category === c);
