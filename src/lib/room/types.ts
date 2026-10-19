import { z } from "zod";
import { AVATAR_MOTIFS } from "@/design/Avatar";
import { MAX_DISPLAY_NAME } from "@/lib/config";

export type Profile = {
  id: string;
  display_name: string;
  avatar_key: string;
  avatar_hue: number;
  onboarded_at: string | null;
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

export type Room = {
  id: string;
  name: string;
  invite_code: string | null;
  created_by: string | null;
  paired_at: string | null;
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

export type RoomBundle = {
  room: Room;
  me: { profile: Profile; member: Member };
  partner: { profile: Profile; member: Member } | null;
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