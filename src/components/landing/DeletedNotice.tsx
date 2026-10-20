"use client";

import { useSearchParams } from "next/navigation";

/** Client-side so the landing page stays statically prerendered. */
export function DeletedNotice() {
  if (useSearchParams().get("deleted") !== "1") return null;
  return (
    <p role="status" className="border-b border-line bg-sunk px-4 py-3 text-center text-[0.92rem]">
      Your account and everything you wrote has been deleted. Thanks for playing.
    </p>
  );
}