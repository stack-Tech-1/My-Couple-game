import { z } from "zod";
import { AVATAR_MOTIFS } from "@/design/Avatar";
import { MAX_DISPLAY_NAME } from "@/lib/config";

export type Profile = {
  id: string;
  display_name: string;
  avatar_key: string;
  avatar_hue: number;
  onboarded_at: string | null;
  /** The person's theme, on every room and device (set on their account). */
  theme?: "day" | "night" | "auto";
  /** Welcome tour: start it, offer it, or already seen. */
  tour?: "auto" | "ask" | "done";
  /** Games whose "how to play" tour this person has finished or skipped. */
  toured_games?: string[];
  /**
   * Set when I've given this person a pet name: display_name then holds the pet name (that's what
   * every screen shows me) and real_name the name they chose. Never sent to anyone else.
   */
  real_name?: string;
  /** Birthday, day and month only (never a year). Both set or both null. */
  birth_month?: number | null;
  birth_day?: number | null;
};

export type Member = {
  room_id: string;
  user_id: string;
  joined_at: string;
  theme: "day" | "night" | "auto";
  sound_enabled: boolean;
  age_confirmed_at: string | null;
  spicy_opt_in: boolean;
  max_heat: number;
};

export type RoomKind = "couple" | "friends";
/** Couple rooms hold 2; friend rooms up to this many. Each person: 1 couple room, up to MAX_FRIEND_ROOMS friend rooms. */
export const FRIEND_ROOM_SIZE = 8;
export const MAX_FRIEND_ROOMS = 5;

export type Room = {
  id: string;
  name: string;
  kind: RoomKind;
  /** Friend rooms: the person who can rename, invite and remove. */
  owner_id: string | null;
  invite_code: string | null;
  created_by: string | null;
  paired_at: string | null;
  /** When the couple got together (YYYY-MM-DD), if they've said. */
  together_since: string | null;
  settings: RoomSettings;
  created_at: string;
};

export type Moment = {
  id: number;
  room_id: string;
  kind: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
};

export type RoomPerson = { profile: Profile; member: Member };
/** A room I'm in, for the switcher. */
export type RoomSummary = { id: string; name: string; kind: RoomKind; members: number };

export type RoomBundle = {
  room: Room;
  me: RoomPerson;
  /** Couple rooms: the other person. Friend rooms: always null (see `members`). */
  partner: RoomPerson | null;
  /** Everyone in the room, me included, longest-standing first. */
  members: RoomPerson[];
  /** Every room I'm in, couple room first. */
  rooms: RoomSummary[];
  /** People I've blocked: their messages and invites are hidden from me. */
  blocked: string[];
};

export const roomSettingsSchema = z
  .object({
    houseRules: z.record(z.string(), z.record(z.string(), z.union([z.boolean(), z.number(), z.string()]))).default({}),
  })
  .partial();
export type RoomSettings = z.infer<typeof roomSettingsSchema>;

export const profileInput = z.object({
  display_name: z.string().trim().min(1, "Everyone needs a name. Even a nickname.").max(MAX_DISPLAY_NAME, "Shorter, please. It has to fit on a scoreboard."),
  avatar_key: z.enum(Object.keys(AVATAR_MOTIFS) as [keyof typeof AVATAR_MOTIFS, ...(keyof typeof AVATAR_MOTIFS)[]]),
  avatar_hue: z.number().int().min(0).max(359),
});

export const roomNameInput = z.string().trim().min(1, "A room needs a name.").max(40, "Forty characters, tops.");
export const inviteCodeInput = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-HJ-NP-Z2-9]{6}$/, "Invite codes are six letters and numbers.");

export const prefsInput = z.object({
  theme: z.enum(["day", "night", "auto"]).optional(),
  sound_enabled: z.boolean().optional(),
});

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };
export const REPORT_REASONS = ["harassment", "pressure", "intimate_images", "underage", "spam", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_LABELS: Record<ReportReason, string> = {
  harassment: "Harassment, threats or abuse",
  pressure: "Pressuring me into something",
  intimate_images: "Sharing intimate images without consent",
  underage: "They might be under 18",
  spam: "Spam or a scam",
  other: "Something else",
};
