import { z } from "zod";
import { DAILY_QUESTIONS, DEEP_QUESTIONS, HOW_WELL, STORY_OPENERS, THIS_OR_THAT } from "@/content/personal";
import { DATE_IDEAS, type DateIdea } from "@/content/date-ideas";
import { DARES, HOT_SEAT, NEVER, TRUTHS, type Card, type Heat } from "@/content/after-dark";

/**
 * Every deck the admin can edit. A deck is the built-in content (in src/content, versioned with
 * the code) plus additions from the database, minus built-ins the admin has switched off.
 *
 * Built-ins are identified by a hash of their content, so editing a line in src/content simply
 * makes it a new item; anything hidden under its old wording stays hidden only under that wording.
 */

export const HEATS = [1, 2, 3] as const;
const heat = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const line = (max: number) => z.string().trim().min(2, "Too short.").max(max, `Keep it under ${max} characters.`);

export type HowWellItem = { q: string; options: [string, string, string, string] };
export type DeepItem = { level: number; text: string };

export type ContentTypes = {
  daily_question: { text: string };
  date_idea: DateIdea;
  this_or_that: { a: string; b: string };
  story_opener: { text: string };
  how_well: HowWellItem;
  deep_question: DeepItem;
  truth: Card;
  dare: Card;
  hot_seat: Card;
  never: Card;
};
export type ContentKind = keyof ContentTypes;

type Def<K extends ContentKind> = {
  label: string;
  group: "Everyday" | "Games" | "After Dark";
  /** Where it shows up, for the admin. */
  usedIn: string;
  schema: z.ZodType<ContentTypes[K]>;
  builtIn: () => ContentTypes[K][];
  /** One line to show in lists. */
  summary: (item: ContentTypes[K]) => string;
  /** Changes apply from the next UTC day (so nobody's question changes mid-day). */
  daily?: boolean;
};

const card = (max = 200) => z.object({ text: line(max), heat }) as z.ZodType<Card>;

export const DEEP_LEVELS = DEEP_QUESTIONS.map((l) => l.level);

export const KINDS: { [K in ContentKind]: Def<K> } = {
  daily_question: {
    label: "Daily Questions",
    group: "Everyday",
    usedIn: "The question of the day on every room's home screen.",
    schema: z.object({ text: line(200) }),
    builtIn: () => DAILY_QUESTIONS.map((text) => ({ text })),
    summary: (i) => i.text,
    daily: true,
  },
  date_idea: {
    label: "Date ideas",
    group: "Everyday",
    usedIn: "Date Night Generator.",
    schema: z.object({
      title: line(60),
      detail: line(200),
      where: z.enum(["home", "out", "distance"]),
      budget: z.union([z.literal(0), z.literal(1), z.literal(2)]),
    }) as z.ZodType<DateIdea>,
    builtIn: () => DATE_IDEAS,
    summary: (i) => `${i.title}: ${i.detail}`,
  },
  this_or_that: {
    label: "This or That",
    group: "Games",
    usedIn: "This or That rounds.",
    schema: z.object({ a: line(60), b: line(60) }),
    builtIn: () => THIS_OR_THAT.map(([a, b]) => ({ a, b })),
    summary: (i) => `${i.a}  /  ${i.b}`,
  },
  story_opener: {
    label: "Story openers",
    group: "Games",
    usedIn: "The first line of a Story Chain.",
    schema: z.object({ text: line(200) }),
    builtIn: () => STORY_OPENERS.map((text) => ({ text })),
    summary: (i) => i.text,
  },
  how_well: {
    label: "How Well questions",
    group: "Games",
    usedIn: "How Well Do You Know Me (a question and four answers).",
    schema: z.object({ q: line(100), options: z.tuple([line(60), line(60), line(60), line(60)]) }),
    builtIn: () => HOW_WELL,
    summary: (i) => `${i.q} (${i.options.join(" · ")})`,
  },
  deep_question: {
    label: "Deep Questions",
    group: "Games",
    usedIn: "Deep Questions, at one of its three levels.",
    schema: z.object({ level: z.number().int().min(0).max(DEEP_QUESTIONS.length - 1), text: line(200) }),
    builtIn: () => DEEP_QUESTIONS.flatMap((l, level) => l.questions.map((text) => ({ level, text }))),
    summary: (i) => `${DEEP_LEVELS[i.level] ?? "?"}: ${i.text}`,
  },
  truth: { label: "Truths", group: "After Dark", usedIn: "Truth or Dare (After Dark).", schema: card(), builtIn: () => TRUTHS, summary: (i) => i.text },
  dare: { label: "Dares", group: "After Dark", usedIn: "Truth or Dare (After Dark).", schema: card(), builtIn: () => DARES, summary: (i) => i.text },
  hot_seat: { label: "Hot Seat", group: "After Dark", usedIn: "Hot Seat (After Dark).", schema: card(), builtIn: () => HOT_SEAT, summary: (i) => i.text },
  never: { label: "Never Have I Ever", group: "After Dark", usedIn: "Never Have I Ever (After Dark).", schema: card(), builtIn: () => NEVER, summary: (i) => i.text },
};

export const KIND_ORDER = Object.keys(KINDS) as ContentKind[];
export const isKind = (k: unknown): k is ContentKind => typeof k === "string" && k in KINDS;
export const heatLabel = (h: Heat) => ({ 1: "Warm", 2: "Hot", 3: "Fire" })[h];

/** Stable id for a built-in item: FNV-1a over its JSON, base36. */
export function builtInKey(kind: ContentKind, item: unknown): string {
  let h = 2166136261;
  for (const ch of `${kind}:${JSON.stringify(item)}`) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return `b_${(h >>> 0).toString(36)}`;
}

export type Overrides = {
  added: { id: string; kind: ContentKind; body: unknown; created_at: string }[];
  hidden: { kind: ContentKind; key: string; created_at: string }[];
};

/**
 * The live deck for one kind. `asOf` limits changes to those made before that moment (the Daily
 * Question uses the start of the current UTC day). Never empty: if everything is hidden, the
 * built-ins come back rather than breaking a game.
 */
export function deck<K extends ContentKind>(kind: K, o: Overrides, asOf?: number): ContentTypes[K][] {
  const def = KINDS[kind] as Def<K>;
  const before = (iso: string) => asOf === undefined || Date.parse(iso) < asOf;
  const hidden = new Set(o.hidden.filter((h) => h.kind === kind && before(h.created_at)).map((h) => h.key));
  const built = def.builtIn().filter((item) => !hidden.has(builtInKey(kind, item)));
  const extra = o.added.flatMap((a) => {
    if (a.kind !== kind || !before(a.created_at) || hidden.has(a.id)) return [];
    const p = def.schema.safeParse(a.body);
    return p.success ? [p.data] : [];
  });
  const all = [...built, ...extra];
  return all.length ? all : def.builtIn();
}

/** Decks a game can receive when it starts (see MoveContext.content). */
export const GAME_KINDS = ["how_well", "this_or_that", "story_opener", "deep_question", "truth", "dare", "hot_seat", "never"] as const;
export type GameContentKind = (typeof GAME_KINDS)[number];
export type ContentPack = { [K in GameContentKind]?: ContentTypes[K][] };
