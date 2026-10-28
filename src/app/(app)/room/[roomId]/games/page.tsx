import type { Metadata } from "next";
import { GamesTab } from "@/components/room/GamesTab";

export const metadata: Metadata = { title: "Games" };

/** The Games tab: the whole shelf, with a chip for each mood. */
export default function GamesPage() {
  return <GamesTab />;
}
