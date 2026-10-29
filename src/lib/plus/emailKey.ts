import { createHash } from "node:crypto";

/**
 * One key per real inbox, for "one free trial each": lower case, no "+tag", and for Gmail no dots
 * (Gmail ignores both). Stored only as a SHA-256 hash, so it can't be turned back into the address.
 */
export function emailKey(email: string): string {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  let l = local.split("+")[0]!;
  const d = domain === "googlemail.com" ? "gmail.com" : domain;
  if (d === "gmail.com") l = l.replace(/\./g, "");
  return createHash("sha256").update(`${l}@${d}`).digest("hex");
}
