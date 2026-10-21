"use client";

import { useState, type FormEvent } from "react";
import { z } from "zod";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/design/Button";
import { TextField } from "@/design/Field";
import { Rule } from "@/design/Panel";
import { Icon } from "@/design/icons";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { friendlyError } from "@/lib/errors";
import { track } from "@/lib/analytics";
import { suggestEmail } from "@/lib/emailTypos";

const emailSchema = z.email();

export function SignInForm({ next, linkError, google: googleEnabled }: { next: string; linkError: boolean; google: boolean }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(
    linkError ? "That link has expired or was already used. Send yourself a fresh one." : null,
  );
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  // A likely typo in the domain ("gmail.co"): offered once they leave the box or press send.
  const [checked, setChecked] = useState(false);
  const [keepAsTyped, setKeepAsTyped] = useState<string | null>(null);
  const suggestion = suggestEmail(email);
  const showSuggestion = !!suggestion && checked && keepAsTyped !== email.trim();

  const redirectTo = (path: string) => `${window.location.origin}${path}?next=${encodeURIComponent(next)}`;

  async function sendLink(e: FormEvent) {
    e.preventDefault();
    const parsed = emailSchema.safeParse(email.trim());
    if (!parsed.success) {
      setError("That doesn't look like an email address. Typo?");
      return;
    }
    if (suggestion && keepAsTyped !== email.trim()) {
      setChecked(true);
      return;
    }
    setError(null);
    setSending(true);
    try {
      const { error: err } = await supabaseBrowser().auth.signInWithOtp({
        email: parsed.data,
        options: { emailRedirectTo: redirectTo("/auth/callback"), shouldCreateUser: true },
      });
      if (err) throw err;
      track("auth_link_sent");
      setSentTo(parsed.data);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSending(false);
    }
  }

  async function google() {
    setError(null);
    const { error: err } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: redirectTo("/auth/callback") },
    });
    if (err) setError(friendlyError(err));
  }

  return (
    <div className="min-w-0 rounded-[22px] border-[1.5px] border-line-strong bg-raised p-6 sm:p-8">
      <AnimatePresence mode="wait" initial={false}>
        {sentTo ? (
          <motion.div key="sent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Icon name="envelope" size={36} className="text-accent" />
            <h2 className="display mt-4 text-[2rem]">Check your inbox.</h2>
            <p className="mt-3 leading-relaxed text-muted">
              We sent a sign-in link to <b className="break-all text-fg">{sentTo}</b>. It works once and expires in an hour. First time here? It may be titled
              &ldquo;Confirm your email address&rdquo;: same link, same result. If it hasn&apos;t shown up in a minute, the spam
              folder is the usual suspect.
            </p>
            <Button variant="ghost" className="mt-6 -ml-3" onClick={() => setSentTo(null)} icon="arrowLeft">
              Use a different email
            </Button>
          </motion.div>
        ) : (
          <motion.div key="form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {googleEnabled ? (
              <>
                <Button variant="outline" size="lg" className="w-full" icon="google" onClick={google}>
                  Continue with Google
                </Button>
                <Rule label="or" className="my-6" />
              </>
            ) : null}
            <form onSubmit={sendLink} noValidate className="flex flex-col gap-4">
              <TextField
                label="Email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@somewhere.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => setChecked(true)}
                error={error}
              />
              {showSuggestion ? (
                <div role="status" className="-mt-1 rounded-[14px] border-[1.5px] border-brass bg-[color-mix(in_srgb,var(--brass)_14%,transparent)] px-4 py-3 text-[0.92rem]">
                  <p>
                    Did you mean <b className="break-all">{suggestion}</b>?
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="primary" onClick={() => setEmail(suggestion!)}>
                      Yes, fix it
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setKeepAsTyped(email.trim())}>
                      No, mine is right
                    </Button>
                  </div>
                </div>
              ) : null}
              <Button type="submit" size="lg" loading={sending} iconRight="arrowRight">
                Email me a link
              </Button>
            </form>
            <p className="mt-5 text-[0.82rem] leading-relaxed text-muted">
              By continuing you agree to the{" "}
              <a href="/terms" className="underline underline-offset-2">Terms</a> and{" "}
              <a href="/privacy" className="underline underline-offset-2">Privacy Policy</a>.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}