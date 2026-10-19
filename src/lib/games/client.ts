"use client";

import { createStore } from "zustand/vanilla";
import type { SessionRow, SessionSnapshot } from "./types";

export class GameApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "content-type": "application/json", ...init?.headers }, cache: "no-store" });
  } catch {
    throw new GameApiError(0, "Couldn't reach the server. Is the Wi-Fi napping?");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new GameApiError(res.status, body.error ?? "Something went sideways. Try that once more?");
  return body as T;
}

export const gameApi = {
  snapshot: (id: string) => call<SessionSnapshot>(`/api/sessions/${id}`),
  move: (id: string, move: unknown, expectedVersion: number) =>
    call<SessionSnapshot>(`/api/sessions/${id}/move`, { method: "POST", body: JSON.stringify({ move, expectedVersion }) }),
  resign: (id: string) => call<SessionRow>(`/api/sessions/${id}/resign`, { method: "POST" }),
  create: (gameId: string, opts: { config?: Record<string, unknown>; rematchOf?: string } = {}) =>
    call<SessionRow>(`/api/sessions`, { method: "POST", body: JSON.stringify({ gameId, ...opts }) }),
};

export type GameStoreState = {
  session: SessionRow;
  view: unknown;
  version: number;
  pending: boolean;
  /** Accepts a snapshot only if it is newer than what we hold (realtime and HTTP can race). */
  accept: (s: Partial<SessionSnapshot> & { version: number }) => void;
  setSession: (s: SessionRow) => void;
  setPending: (p: boolean) => void;
};

export function createGameStore(initial: SessionSnapshot) {
  return createStore<GameStoreState>((set, get) => ({
    session: initial.session,
    view: initial.view,
    version: initial.version,
    pending: false,
    accept: (s) => {
      // Never adopt a malformed snapshot (no session id / version), whatever the server sent.
      if (typeof s.version !== "number" || (s.session && typeof s.session.id !== "string")) return;
      if (s.version < get().version) return;
      set({
        version: s.version,
        ...(s.view !== undefined ? { view: s.view } : {}),
        ...(s.session ? { session: s.session } : {}),
      });
    },
    setSession: (session) => {
      if (session.version < get().session.version) return;
      set({ session });
    },
    setPending: (pending) => set({ pending }),
  }));
}
