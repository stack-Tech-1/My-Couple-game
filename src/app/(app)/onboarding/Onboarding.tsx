"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, AVATAR_HUES, AVATAR_MOTIFS, type AvatarMotif } from "@/design/Avatar";
import { Button } from "@/design/Button";
import { TextField } from "@/design/Field";
import { Logo } from "@/design/Logo";
import { cn } from "@/lib/cn";
import { saveProfile } from "@/lib/room/actions";
import { NewRoomForm } from "@/components/friends/NewRoomForm";
import type { Profile } from "@/lib/room/types";
import { track } from "@/lib/analytics";

type Step = "you" | "room";

export function Onboarding({ profile, startAt, next }: { profile: Profile; startAt: Step; next: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(startAt);
  const [name, setName] = useState(profile.display_name);
  const [motif, setMotif] = useState<AvatarMotif>((profile.avatar_key in AVATAR_MOTIFS ? profile.avatar_key : "fig") as AvatarMotif);
  const [hue, setHue] = useState<number>(profile.avatar_hue);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [agreed, setAgreed] = useState(false);

  function submitYou(e: FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await saveProfile({ display_name: name, avatar_key: motif, avatar_hue: hue }, agreed);
      if (!res.ok) return setError(res.error);
      track("onboarding_profile_saved");
      if (next) return router.push(next);
      setStep("room");
    });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-4 py-5 sm:px-8">
      <div className="flex items-center justify-between">
        <Logo />
        <span className="eyebrow tabular text-muted">Step {step === "you" ? 1 : 2} of 2</span>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {step === "you" ? (
          <motion.form
            key="you"
            onSubmit={submitYou}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            className="flex flex-1 flex-col py-12"
          >
            <h1 className="display text-[clamp(2.6rem,9vw,3.8rem)]">First, who&apos;s playing?</h1>
            <p className="mt-3 text-muted">This is what your partner sees on the scoreboard. Choose wisely, it&apos;ll be there when you lose.</p>

            <div className="mt-10 flex items-center gap-5">
              <Avatar name={name || "You"} motif={motif} hue={hue} size={88} />
              <div className="flex-1">
                <TextField label="Your name" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} autoComplete="given-name" placeholder="What they call you" required />
              </div>
            </div>

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
                    onClick={() => setMotif(m)}
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
                    onClick={() => setHue(h)}
                    className={cn("h-9 w-9 rounded-full border-[1.5px] transition-transform", hue === h ? "scale-110 border-line-strong ring-2 ring-offset-2 ring-offset-bg" : "border-transparent")}
                    style={{ background: `hsl(${h} 52% 72%)`, ["--tw-ring-color" as string]: `hsl(${h} 40% 30%)` }}
                  />
                ))}
              </div>
            </fieldset>

            <label className="mt-8 flex cursor-pointer items-start gap-3 rounded-[14px] border-[1.5px] border-line bg-raised p-4">
              <input type="checkbox" required checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />
              <span className="text-[0.92rem] leading-snug">
                I&apos;m 18 or older, and I agree to the{" "}
                <a href="/terms" target="_blank" className="font-semibold underline underline-offset-2">Terms</a> and{" "}
                <a href="/privacy" target="_blank" className="font-semibold underline underline-offset-2">Privacy Policy</a>.
              </span>
            </label>

            {error ? <p role="alert" className="mt-6 font-medium text-accent-ink">{error}</p> : null}
            <Button type="submit" size="lg" className="mt-auto w-full sm:mt-12" loading={pending} iconRight="arrowRight" disabled={!agreed}>
              {next ? "Continue to your invite" : "Next: your room"}
            </Button>
          </motion.form>
        ) : (
          <motion.div
            key="room"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            className="flex flex-1 flex-col py-12"
          >
            <h1 className="display text-[clamp(2.6rem,9vw,3.8rem)]">Now, your first room.</h1>
            <p className="mt-3 mb-10 text-muted">A couple room is just for the two of you. A friend room fits up to eight. You can have one of each, and more friend rooms later.</p>
            <NewRoomForm name={name} hasCouple={false} friendRooms={0} initialMode={next?.startsWith("/join/") ? "join" : "couple"} onBack={() => setStep("you")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}