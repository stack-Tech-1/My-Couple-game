"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/design/Button";
import { acceptTerms } from "@/lib/room/actions";

/**
 * Shown once to people who signed up before the current Terms (or before we asked for the 18+
 * confirmation). It can't be dismissed: using Amah means accepting them.
 */
export function TermsGate({ firstTime }: { firstTime: boolean }) {
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  function accept() {
    start(async () => {
      const res = await acceptTerms(agreed);
      if (!res.ok) return setError(res.error);
      ref.current?.close();
      router.refresh();
    });
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => e.preventDefault()}
      aria-labelledby="terms-title"
      className="amah-modal m-0 mt-auto w-full max-w-none rounded-t-[22px] border border-line bg-bg p-0 text-fg backdrop:bg-[rgba(18,12,14,.62)] sm:m-auto sm:max-w-lg sm:rounded-[22px]"
    >
      <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-6">
        <h2 id="terms-title" className="display text-[1.9rem] leading-tight">
          {firstTime ? "One quick thing" : "We've updated our terms"}
        </h2>
        <p className="mt-3 text-muted">
          {firstTime
            ? "Amah is for adults, and we've written down exactly how we look after your data. Please confirm before you carry on."
            : "We've updated our Terms and Privacy Policy. Please take a look and confirm before you carry on."}
        </p>
        <ul className="mt-4 list-disc space-y-1.5 pl-5 text-[0.9rem] text-muted">
          <li>Your room stays between you and your partner. Our team doesn&apos;t read your messages, notes or photos.</li>
          <li>You can ask for a copy of your data, or delete your account, any time.</li>
          <li>Report or block from Settings if anything ever feels wrong.</li>
        </ul>
        <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-[14px] border-[1.5px] border-line bg-raised p-4">
          <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--accent)]" />
          <span className="text-[0.92rem] leading-snug">
            I&apos;m 18 or older, and I agree to the{" "}
            <a href="/terms" target="_blank" className="font-semibold underline underline-offset-2">Terms</a> and{" "}
            <a href="/privacy" target="_blank" className="font-semibold underline underline-offset-2">Privacy Policy</a>.
          </span>
        </label>
        {error ? <p role="alert" className="mt-3 text-[0.9rem] font-medium text-accent-ink">{error}</p> : null}
        <Button className="mt-5 w-full" size="lg" onClick={accept} loading={pending} disabled={!agreed}>
          Continue
        </Button>
        <p className="mt-4 text-center text-[0.8rem] text-muted">
          Not for you? You can delete your account from Settings at any time.
        </p>
      </div>
    </dialog>
  );
}
