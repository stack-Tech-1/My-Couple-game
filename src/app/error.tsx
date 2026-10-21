"use client";

import { useEffect, useState } from "react";
import { Button } from "@/design/Button";
import { reportError } from "@/lib/monitoring/client";

/** "Load failed" (Safari), "Failed to fetch" (Chrome) and friends: the phone lost its connection. */
const looksOffline = (e: Error) => /^(Load failed|Failed to fetch)$|NetworkError|Couldn't reach the server/i.test(e.message);

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const network = looksOffline(error);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    console.error(error);
    // A dropped connection isn't a bug; everything else goes to error tracking.
    if (!network) reportError(error);
  }, [error, network]);

  // Lost connection: try again by itself as soon as the phone is back online.
  useEffect(() => {
    if (!network) return;
    setOnline(navigator.onLine);
    const back = () => {
      setOnline(true);
      reset();
    };
    const gone = () => setOnline(false);
    window.addEventListener("online", back);
    window.addEventListener("offline", gone);
    return () => {
      window.removeEventListener("online", back);
      window.removeEventListener("offline", gone);
    };
  }, [network, reset]);

  if (network) {
    return (
      <div className="relative z-[1] mx-auto flex min-h-[70dvh] max-w-xl flex-col justify-center px-4 sm:px-8">
        <p className="eyebrow text-accent-ink">Connection dropped</p>
        <h1 className="display mt-4 text-[clamp(2.6rem,8vw,4rem)]">We lost the signal for a moment.</h1>
        <p className="mt-4 text-muted">
          {online
            ? "Your games and scores are safe on our side. Try again and everything will be where you left it."
            : "You look offline right now. As soon as your connection is back, this page will reload by itself."}
        </p>
        <div className="mt-8 flex gap-3">
          <Button onClick={reset} icon="refresh">Try again</Button>
          <Button variant="ghost" onClick={() => (window.location.href = "/room")}>Back to the room</Button>
        </div>
      </div>
    );
  }

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
