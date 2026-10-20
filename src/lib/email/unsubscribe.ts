import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { siteUrl } from "@/lib/config";

/**
 * Unsubscribe links carry the user id and an HMAC of it, so they work without signing in and
 * can't be forged for someone else. The secret defaults to the service role key (server only).
 */
const secret = () => process.env.EMAIL_LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export function unsubscribeToken(userId: string): string {
  return createHmac("sha256", secret()).update(`unsubscribe:${userId}`).digest("base64url").slice(0, 32);
}

export function verifyUnsubscribe(userId: string, token: string): boolean {
  if (!secret()) return false;
  const want = Buffer.from(unsubscribeToken(userId));
  const got = Buffer.from(token);
  return want.length === got.length && timingSafeEqual(want, got);
}

const query = (userId: string) => `u=${encodeURIComponent(userId)}&t=${unsubscribeToken(userId)}`;
/** The footer link: a page with an Unsubscribe button. */
export const unsubscribeUrl = (userId: string) => `${siteUrl()}/email/unsubscribe?${query(userId)}`;
/** The List-Unsubscribe header target: mail apps POST here for one-click unsubscribe. */
export const oneClickUrl = (userId: string) => `${siteUrl()}/api/email/unsubscribe?${query(userId)}`;
