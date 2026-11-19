"use server";

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUser } from "@/lib/room/server";
import type { ActionResult } from "@/lib/room/types";
import { AREAS, isUpgrade, upgradePrice, type UpgradeId } from "./games/mama";
import { mamaOwned } from "./mama-server";
import { GEAR, SKINS, isGear, isSkin } from "./games/okada";
import { randomBytes } from "node:crypto";
import { HELPERS, lookPrice, type HelperId } from "./games/zobo";
import { GEAR as MOSQUITO_GEAR, isGear as isMosquitoGear } from "./games/mosquito";

const buyInput = z.object({ area: z.number().int().min(0).max(AREAS.length - 1), item: z.string().max(30) });

/** Buy a Mama Put upgrade for one area's restaurant. The price comes from here, never the phone. */
export async function buyMamaUpgrade(raw: unknown): Promise<ActionResult<{ savings: number; owned: UpgradeId[] }>> {
  const p = buyInput.safeParse(raw);
  if (!p.success || !isUpgrade(p.data.item)) return { ok: false, error: "We don't sell that." };
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in to shop." };
  const price = upgradePrice(p.data.area, p.data.item);
  const { data, error } = await supabaseAdmin().rpc("solo_shop_buy", { p_user: user.id, p_game: "mama-put", p_area: p.data.area, p_item: p.data.item, p_price: price });
  if (error) {
    if (error.message.includes("not enough savings")) return { ok: false, error: "Not enough savings yet. A few more lunch rushes!" };
    if (error.message.includes("already owned")) return { ok: false, error: "You already have that here." };
    return { ok: false, error: "Couldn't buy it. Try again?" };
  }
  return { ok: true, data: { savings: Number(data), owned: await mamaOwned(user.id, p.data.area) } };
}

/** Buy Okada Rush gear or a bike colour. The price comes from here, never the phone. */
export async function buyOkadaGear(raw: unknown): Promise<ActionResult<{ savings: number }>> {
  const p = z.object({ item: z.string().max(30) }).safeParse(raw);
  const item = p.success ? p.data.item : "";
  const price = isGear(item) ? GEAR.find((g) => g.id === item)!.price : isSkin(item) ? SKINS.find((s) => s.id === item)!.price : null;
  if (price == null || item === "skin-red") return { ok: false, error: "The garage doesn't sell that." };
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in to shop." };
  const { data, error } = await supabaseAdmin().rpc("solo_shop_buy", { p_user: user.id, p_game: "okada-rush", p_area: 0, p_item: item, p_price: price });
  if (error) {
    if (error.message.includes("not enough savings")) return { ok: false, error: "Not enough savings yet. A few more rides!" };
    if (error.message.includes("already owned")) return { ok: false, error: "You already have that." };
    return { ok: false, error: "Couldn't buy it. Try again?" };
  }
  return { ok: true, data: { savings: Number(data) } };
}

/** Buy a Zobo Sort bottle or shelf look. The price comes from here, never the phone. */
export async function buyZoboLook(raw: unknown): Promise<ActionResult<{ savings: number }>> {
  const p = z.object({ item: z.string().max(30) }).safeParse(raw);
  const item = p.success ? p.data.item : "";
  const price = lookPrice(item);
  if (price == null) return { ok: false, error: "The stall doesn't sell that." };
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in to shop." };
  const { data, error } = await supabaseAdmin().rpc("solo_shop_buy", { p_user: user.id, p_game: "zobo-sort", p_area: 0, p_item: item, p_price: price });
  if (error) {
    if (error.message.includes("not enough savings")) return { ok: false, error: "Not enough savings yet. A few more levels!" };
    if (error.message.includes("already owned")) return { ok: false, error: "You already have that." };
    return { ok: false, error: "Couldn't buy it. Try again?" };
  }
  return { ok: true, data: { savings: Number(data) } };
}

/** Buy Mosquito Wahala gear. The price comes from here, never the phone. */
export async function buyMosquitoGear(raw: unknown): Promise<ActionResult<{ savings: number }>> {
  const p = z.object({ item: z.string().max(30) }).safeParse(raw);
  const item = p.success ? p.data.item : "";
  if (!isMosquitoGear(item)) return { ok: false, error: "The shop doesn't sell that." };
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in to shop." };
  const { data, error } = await supabaseAdmin().rpc("solo_shop_buy", { p_user: user.id, p_game: "mosquito-wahala", p_area: 0, p_item: item, p_price: MOSQUITO_GEAR.find((g) => g.id === item)!.price });
  if (error) {
    if (error.message.includes("not enough savings")) return { ok: false, error: "Not enough savings yet. A few more nights!" };
    if (error.message.includes("already owned")) return { ok: false, error: "You already have that." };
    return { ok: false, error: "Couldn't buy it. Try again?" };
  }
  return { ok: true, data: { savings: Number(data) } };
}

/** Pay for a hint or an extra bottle. Each one is its own purchase, so they can be bought again. */
export async function buyZoboHelper(raw: unknown): Promise<ActionResult<{ savings: number }>> {
  const p = z.object({ kind: z.enum(Object.keys(HELPERS) as [HelperId, ...HelperId[]]) }).safeParse(raw);
  if (!p.success) return { ok: false, error: "The stall doesn't sell that." };
  const user = await getUser();
  if (!user) return { ok: false, error: "Sign in to shop." };
  const item = `${p.data.kind}-${randomBytes(9).toString("hex")}`;
  const { data, error } = await supabaseAdmin().rpc("solo_shop_buy", { p_user: user.id, p_game: "zobo-sort", p_area: 1, p_item: item, p_price: HELPERS[p.data.kind].price });
  if (error) return { ok: false, error: error.message.includes("not enough savings") ? "Not enough savings yet. A few more levels!" : "Couldn't buy it. Try again?" };
  return { ok: true, data: { savings: Number(data) } };
}
