"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Avatar, AVATAR_HUES, AVATAR_MOTIFS, type AvatarMotif } from "@/design/Avatar";
import { Button } from "@/design/Button";
import { TextField } from "@/design/Field";
import { Logo } from "@/design/Logo";
import { Icon } from "@/design/icons";
import { cn } from "@/lib/cn";
import { createRoom, joinRoom, saveProfile } from "@/lib/room/actions";
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
  const [mode, setMode] = useState<"create" | "join">(next?.startsWith("/join/") ? "join" : "create");
  const [roomName, setRoomName] = useState("");
  const [code, setCode] = useState("");

  function submitYou(e: FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await saveProfile({ display_name: name, avatar_key: motif, avatar_hue: hue });
      if (!res.ok) return setError(res.error);
      track("onboarding_profile_saved");
      if (next) return router.push(next);
      setStep("room");
    });
  }

  function submitRoom(e: FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = mode === "create" ? await createRoom(roomName.trim() || `${name.trim()}'s room`) : await joinRoom(code);
      if (!res.ok) return setError(res.error);
      track(mode === "create" ? "room_created" : "room_joined");
      router.push(`/room/${res.data.id}`);
      router.refresh();
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

            {error ? <p role="alert" className="mt-6 font-medium text-accent-ink">{error}</p> : null}
            <Button type="submit" size="lg" className="mt-auto w-full sm:mt-12" loading={pending} iconRight="arrowRight">
              {next ? "Continue to your invite" : "Next: your room"}
            </Button>
          </motion.form>
        ) : (
          <motion.form
            key="room"
            onSubmit={submitRoom}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            className="flex flex-1 flex-col py-12"
          >
            <h1 className="display text-[clamp(2.6rem,9vw,3.8rem)]">Now, a room for two.</h1>
            <p className="mt-3 text-muted">Start one and invite your person, or use the code they sent you.</p>

            <div role="radiogroup" aria-label="Start or join" className="mt-10 grid grid-cols-2 gap-3">
              {([
                ["create", "door", "Start a room", "I'll send the invite"],
                ["join", "link", "I have a code", "They already started one"],
              ] as const).map(([k, icon, title, sub]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={mode === k}
                  onClick={() => setMode(k)}
                  className={cn(
                    "rounded-[16px] border-[1.5px] p-4 text-left transition-colors",
                    mode === k ? "border-line-strong bg-raised" : "border-line hover:border-[color-mix(in_srgb,var(--line-strong)_40%,var(--line))]",
                  )}
                >
                  <Icon name={icon} size={24} className={mode === k ? "text-accent" : "text-muted"} />
                  <p className="mt-3 font-bold">{title}</p>
                  <p className="text-[0.85rem] text-muted">{sub}</p>
                </button>
              ))}
            </div>

            <div className="mt-8">
              {mode === "create" ? (
                <TextField label="Room name" placeholder={`${name.trim() || "Our"}'s room`} value={roomName} onChange={(e) => setRoomName(e.target.value)} maxLength={40} hint="You can change it later. Inside jokes encouraged." />
              ) : (
                <TextField
                  label="Invite code"
                  placeholder="ABC234"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  className="tabular font-mono text-[1.4rem] tracking-[0.3em]"
                />
              )}
            </div>

            {error ? <p role="alert" className="mt-6 font-medium text-accent-ink">{error}</p> : null}
            <div className="mt-auto flex gap-3 pt-12">
              <Button variant="ghost" size="lg" onClick={() => setStep("you")} icon="arrowLeft">Back</Button>
              <Button type="submit" size="lg" className="flex-1" loading={pending} disabled={mode === "join" && code.length !== 6}>
                {mode === "create" ? "Open the room" : "Join the room"}
              </Button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}