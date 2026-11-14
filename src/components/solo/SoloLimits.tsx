"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { OpenNow } from "@/components/plus/OutOfPlays";

/** Where a Solo player can get Plus, and what's open when today's free plays run out. */
export type SoloLimitsInfo = { plusHref: string | null; openNow: OpenNow[]; /** For share posters. */ me?: { name: string; motif: string; hue: number } };

const Ctx = createContext<SoloLimitsInfo>({ plusHref: null, openNow: [] });

export function SoloLimitsProvider({ value, children }: { value: SoloLimitsInfo; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSoloLimits = () => useContext(Ctx);
