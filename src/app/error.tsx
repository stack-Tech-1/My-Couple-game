"use client";

import { useEffect } from "react";
import { Button } from "@/design/Button";
import { reportError } from "@/lib/monitoring/client";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
    reportError(error);
  }, [error]);
  return (
    <div className="relative z-[1] mx-auto flex min-h-[70dvh] max-w-xl flex-col justify-center px-4 sm:px-8">
      <p className="eyebrow text-accent-ink">Well, that&apos;s awkward</p>
      <h1 className="display mt-4 text-[clamp(2.6rem,8vw,4rem)]">Something knocked the board over.</h1>
      <p className="mt-4 text-muted">Nothing you did. Your games and scores are saved on our side, so trying again should put everything back where it was.</p>
      <div className="mt-8 flex gap-3">
        <Button onClick={reset} icon="refresh">Try again</Button>
        <Button variant="ghost" onClick={() => (window.location.href = "/room")}>Back to the room</Button>
      </div>
      {error.digest ? <p className="mt-8 font-mono text-[0.75rem] text-muted">ref {error.digest}</p> : null}
    </div>
  );
}