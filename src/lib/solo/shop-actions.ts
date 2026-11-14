"use server";

import { z } from "zod";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getUser } from "@/lib/room/server";
import type { ActionResult } from "@/lib/room/types";
import { AREAS, isUpgrade, upgradePrice, type UpgradeId } from "./games/mama";
import { mamaOwned } from "./mama-server";

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
