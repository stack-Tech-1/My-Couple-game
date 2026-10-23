"use client";

import { Avatar, AVATAR_HUES, AVATAR_MOTIFS, type AvatarMotif } from "@/design/Avatar";
import { cn } from "@/lib/cn";

/** Mark and colour pickers, shared by onboarding and Settings. */
export function AvatarPicker({ motif, hue, onMotif, onHue }: { motif: AvatarMotif; hue: number; onMotif: (m: AvatarMotif) => void; onHue: (h: number) => void }) {
  return (
    <>
      <fieldset className="mt-8">
        <legend className="text-[0.82rem] font-semibold">Your mark</legend>
        <div role="radiogroup" className="mt-3 grid grid-cols-4 gap-3 sm:grid-cols-8">
          {(Object.keys(AVATAR_MOTIFS) as AvatarMotif[]).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={motif === m}
              aria-label={m}
              onClick={() => onMotif(m)}
              className={cn("flex aspect-square items-center justify-center rounded-full border-[1.5px] transition-transform", motif === m ? "scale-105 border-line-strong" : "border-transparent hover:border-line")}
            >
              <Avatar name={m} motif={m} hue={hue} size={44} />
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-6">
        <legend className="text-[0.82rem] font-semibold">Colour</legend>
        <div role="radiogroup" className="mt-3 flex flex-wrap gap-3">
          {AVATAR_HUES.map((h) => (
            <button
              key={h}
              type="button"
              role="radio"
              aria-checked={hue === h}
              aria-label={`Colour ${h}`}
              onClick={() => onHue(h)}
              className={cn("h-9 w-9 rounded-full border-[1.5px] transition-transform", hue === h ? "scale-110 border-line-strong ring-2 ring-offset-2 ring-offset-bg" : "border-transparent")}
              style={{ background: `hsl(${h} 52% 72%)`, ["--tw-ring-color" as string]: `hsl(${h} 40% 30%)` }}
            />
          ))}
        </div>
      </fieldset>
    </>
  );
}

/** A stored avatar key, or the default if it's one we no longer offer. */
export const motifOf = (key: string): AvatarMotif => (key in AVATAR_MOTIFS ? key : "fig") as AvatarMotif;
