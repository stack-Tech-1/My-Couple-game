"use client";

import { useEffect, useState } from "react";
import { useRoom } from "@/lib/realtime/RoomProvider";

const lines = {
  morning: ["Morning.", "Coffee first, then cards."],
  afternoon: ["Afternoon.", "A quick round won't hurt anyone. Probably."],
  evening: ["Evening.", "The good part of the day."],
  late: ["Still up?", "Same. Let's play something."],
} as const;

function partOfDay(h: number): keyof typeof lines {
  if (h < 5) return "late";
  if (h < 12) return "morning";
  if (h < 17) return "afternoon";
  if (h < 22) return "evening";
  return "late";
}

export function Greeting() {
  const { bundle } = useRoom();
  // Rendered on the client so it matches the viewer's clock, not the server's.
  const [part, setPart] = useState<keyof typeof lines | null>(null);
  useEffect(() => {
    setPart(partOfDay(new Date().getHours()));
  }, []);
  const [a, b] = lines[part ?? "evening"];
  return (
    <div className="min-h-[5.5rem]" style={{ opacity: part ? 1 : 0, transition: "opacity 300ms" }}>
      <h1 className="display text-[clamp(2.6rem,8vw,4.4rem)]">
        {a} <span className="text-muted">{bundle.me.profile.display_name}.</span>
      </h1>
      <p className="mt-2 text-muted">{b}</p>
    </div>
  );
}