"use client";

/**
 * Keeps this tab's background page refreshes from tripping over each other on a slow network.
 *
 * Two things are counted, each until its reply has been read to the end (the headers are only the
 * start: the page streams in the body, which can take seconds on a slow phone network):
 * - saves (server actions): a refresh that starts while one is coming back cancels its reply;
 * - page loads (the router's data fetches): a second refresh started on top of one still loading
 *   cancels it, and the router can end up showing neither.
 *
 * Only counted, never changed: each reply goes to the router exactly as it arrived.
 */
let saving = 0;
let lastSaved = 0;
let loading = 0;
let patched = false;

type Kind = "save" | "load" | null;

function kindOf(input: RequestInfo | URL, init?: RequestInit): Kind {
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (headers.has("next-action")) return "save";
  // The router's own page data, but not prefetches (those don't replace what's on screen).
  if (headers.has("rsc") && !headers.has("next-router-prefetch")) return "load";
  return null;
}

export function trackActions() {
  if (patched || typeof window === "undefined") return;
  patched = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const kind = kindOf(input, init);
    if (!kind) return original(input, init);
    if (kind === "save") saving++;
    else loading++;
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (kind === "save") {
        saving--;
        lastSaved = Date.now();
      } else loading--;
    };
    try {
      const res = await original(input, init);
      // Only a streamed page is watched; anything else (an error read as text) is left alone.
      if (!res.body || !(res.headers.get("content-type") ?? "").includes("text/x-component")) {
        finish();
        return res;
      }
      // Read by hand so every ending counts: finished, broken off by the network, or cancelled by
      // the reader. The timer is a last resort so a stream that never ends can't hold refreshes.
      const reader = res.body.getReader();
      const watched = new ReadableStream<Uint8Array>({
        async pull(controller) {
          try {
            const { done, value } = await reader.read();
            if (done) {
              finish();
              controller.close();
            } else controller.enqueue(value);
          } catch (e) {
            finish();
            controller.error(e);
          }
        },
        cancel(reason) {
          finish();
          return reader.cancel(reason);
        },
      });
      setTimeout(finish, 15_000);
      try {
        // Keep the very same Response (its url, headers and status are what the router reads);
        // only its body is swapped for the watched copy.
        Object.defineProperty(res, "body", { value: watched, configurable: true });
        return res;
      } catch {
        // The original body is already being read into `watched`, so hand that on instead.
        return new Response(watched, { status: res.status, statusText: res.statusText, headers: res.headers });
      }
    } catch (e) {
      finish();
      throw e;
    }
  };
}

/** True while a save is on its way back, or was a moment ago (its reply is still being applied). */
export const savingNow = () => saving > 0 || Date.now() - lastSaved < 1500;

/** True while the router is loading page data. */
const loadingNow = () => loading > 0;

/** The longest a refresh waits; after this it goes ahead anyway. */
export const MAX_WAIT = 20_000;

let timer: ReturnType<typeof setTimeout> | undefined;
let firstAsked = 0;
let latest: (() => void) | null = null;

/**
 * Refresh the page once nothing else is loading. Every background refresh goes through here, so a
 * burst of reasons (my save, the partner's broadcast, a database change) becomes one refresh, and
 * it never starts on top of a save or another page load. A reason that arrives while a page load
 * is running gets its own refresh after it, since that load may have started before the change.
 */
export function refreshWhenFree(refresh: () => void, wait = 0) {
  latest = refresh;
  // One already waiting fetches the latest page when it fires, so it covers this reason too.
  if (timer) return;
  firstAsked = Date.now();
  timer = setTimeout(fire, wait);
}

function fire() {
  timer = undefined;
  if ((savingNow() || loadingNow()) && Date.now() - firstAsked < MAX_WAIT) {
    timer = setTimeout(fire, 300);
    return;
  }
  const run = latest;
  latest = null;
  run?.();
}
