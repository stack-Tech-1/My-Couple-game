"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, type AvatarMotif } from "@/design/Avatar";
import { AvatarPicker, motifOf } from "@/components/profile/AvatarPicker";
import { Button } from "@/design/Button";
import { TextField } from "@/design/Field";
import { Logo } from "@/design/Logo";
import { saveProfile } from "@/lib/room/actions";
import { NewRoomForm } from "@/components/friends/NewRoomForm";
import { ThemeToggle } from "@/components/ThemeToggle";
import type { Profile } from "@/lib/room/types";
import { track } from "@/lib/analytics";

type Step = "you" | "room";

export function Onboarding({ profile, startAt, next }: { profile: Profile; startAt: Step; next: string | null }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(startAt);
  const [name, setName] = useState(profile.display_name);
  const [motif, setMotif] = useState<AvatarMotif>(motifOf(profile.avatar_key));
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
        <span className="flex items-center gap-2">
          <span className="eyebrow tabular text-muted">Step {step === "you" ? 1 : 2} of 2</span>
          <ThemeToggle />
        </span>
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

            <AvatarPicker motif={motif} hue={hue} onMotif={setMotif} onHue={setHue} />

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