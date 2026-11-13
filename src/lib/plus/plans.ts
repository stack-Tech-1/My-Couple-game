import { z } from "zod";
import { isSoloGame } from "@/lib/solo/catalog";

/**
 * Amah Plus, in one place: what's free, what it costs, and the free limits.
 * Safe for the browser (no secrets). The database enforces the limits too (0026_plus.sql).
 */

/** Everything not listed here needs Plus. */
export const FREE_GAMES = new Set([
  "whot",
  "ludo",
  "ayo",
  "draughts",
  "tic-tac-toe",
  "connect-four",
  "box-am",
  "daily-question",
  "how-well",
  "love-notes",
  "memory-lane",
]);
/** Solo games are free for everyone, always, so they can never count as Plus. */
export const isPlusGame = (gameId: string) => !FREE_GAMES.has(gameId) && !isSoloGame(gameId);

/** Free limits (Plus has none). */
export const FREE_LIMITS = { photos: 5, sealedNotes: 3, friendRooms: 1 } as const;

export const TRIAL_DAYS = 7;

export const PLAN_IDS = ["single", "couple", "group3", "group5", "group8", "gift"] as const;
export type PlanId = (typeof PLAN_IDS)[number];
export type Period = "month" | "year";

type Plan = { label: string; seats: number; month: number; year: number; hint: string };

/** Prices in naira. */
export const PLANS: Record<PlanId, Plan> = {
  single: { label: "Just me", seats: 1, month: 1500, year: 14750, hint: "Plus for you, in every room you're in" },
  couple: { label: "Us two", seats: 2, month: 3000, year: 29500, hint: "Both of you, in every room you're in" },
  group3: { label: "Group of 3", seats: 3, month: 4000, year: 39000, hint: "3 seats for people in this room" },
  group5: { label: "Group of 5", seats: 5, month: 7000, year: 68500, hint: "5 seats for people in this room" },
  group8: { label: "Group of 8", seats: 8, month: 11000, year: 108750, hint: "8 seats for people in this room" },
  gift: { label: "A seat for a friend", seats: 1, month: 1500, year: 14750, hint: "Plus for one friend" },
};
export const GROUP_PLANS: PlanId[] = ["group3", "group5", "group8"];
export const isGroupPlan = (p: string) => (GROUP_PLANS as string[]).includes(p);

export const priceOf = (plan: PlanId, period: Period) => PLANS[plan][period];
export const naira = (n: number) => `₦${n.toLocaleString("en-NG")}`;

export const checkoutInput = z.object({
  plan: z.enum(PLAN_IDS),
  period: z.enum(["month", "year"]),
  /** card: renews automatically. pass: pay once by transfer, USSD or card. */
  method: z.enum(["card", "pass"]),
  roomId: z.uuid(),
  /** Gift seats: who it's for. */
  giftTo: z.uuid().optional(),
  /** Group plans: also give the payer a seat straight away. */
  includeMe: z.boolean().optional(),
});
export type CheckoutInput = z.infer<typeof checkoutInput>;

export const LEAVE_REASONS = {
  break: "We're taking a break",
  not_using: "We don't use Amah much",
  cost: "It costs too much",
  broken: "Something wasn't working",
  breakup: "We've broken up",
  unsafe: "I don't feel safe",
  rather_not: "Rather not say",
} as const;
export type LeaveReason = keyof typeof LEAVE_REASONS;

/** Plus status of the people in a room, as the room page sees it. */
export type PlusInfo = {
  /** False until launch day: everything is free and no Plus screens show. */
  live: boolean;
  /** Per member: when their Plus ends (ISO), or null. */
  until: Record<string, string | null>;
  /** Members whose current Plus is a free trial. */
  trial: string[];
  /** Whether I've used my free trial. */
  trialUsed: boolean;
  /** Friend rooms: a group plan I bought here that still has seats to hand out. */
  seatsToGive?: { purchaseId: string; left: number } | null;
};

export const hasPlus = (info: PlusInfo | undefined, userId: string) => !info?.live || !!info.until[userId];
