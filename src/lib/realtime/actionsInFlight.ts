"use client";

/**
 * How many of this tab's saves (server actions) are still on their way back. A page refresh that
 * starts while one is in flight cancels that save's reply, so the page never shows what was just
 * saved; background refreshes wait for this to reach zero first. On a slow phone network a save
 * can take several seconds, which is exactly when this matters.
 *
 * Only counted, never touched: the reply itself goes to the router exactly as it arrived.
 */
let inFlight = 0;
let lastDone = 0;
let patched = false;

function isAction(input: RequestInfo | URL, init?: RequestInit): boolean {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  return headers.has("next-action");
}

export function trackActions() {
  if (patched || typeof window === "undefined") return;
  patched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isAction(input, init)) return original(input, init);
    inFlight++;
    try {
      return await original(input, init);
    } finally {
      inFlight--;
      lastDone = Date.now();
    }
  };
}

/**
 * True while a save is on its way back, or its reply is still being read and applied (the reply
 * streams in after it starts arriving, so allow it a moment).
 */
export const savingNow = () => inFlight > 0 || Date.now() - lastDone < 1500;

/** The longest a refresh waits for a save; after this it goes ahead anyway. */
export const MAX_WAIT = 8000;

/** Refresh the page once no save of mine is in flight (for refreshes caused by someone else). */
export function refreshWhenFree(refresh: () => void, wait = 0, since = Date.now()) {
  setTimeout(() => (savingNow() && Date.now() - since < MAX_WAIT ? refreshWhenFree(refresh, 500, since) : refresh()), wait);
}
