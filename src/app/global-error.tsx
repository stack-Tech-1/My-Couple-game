"use client";

import { useEffect } from "react";
import { reportError } from "@/lib/monitoring/client";

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => reportError(error), [error]);
  return (
    <html lang="en">
      <body style={{ background: "#f6efe6", color: "#1c1416", fontFamily: "Georgia, serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0, padding: 16 }}>
        <div style={{ maxWidth: 480 }}>
          <h1 style={{ fontSize: 44, letterSpacing: -1.5, lineHeight: 1, margin: 0 }}>The whole table tipped over.</h1>
          <p style={{ fontFamily: "system-ui, sans-serif", color: "#57474a", lineHeight: 1.6 }}>Give it another go. If it keeps happening, a refresh usually does the trick.</p>
          <button onClick={reset} style={{ fontFamily: "system-ui, sans-serif", fontWeight: 600, background: "#1c1416", color: "#f6efe6", border: 0, borderRadius: 999, padding: "12px 22px", cursor: "pointer" }}>Try again</button>
        </div>
      </body>
    </html>
  );
}