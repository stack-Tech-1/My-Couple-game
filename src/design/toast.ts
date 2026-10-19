"use client";

import { create } from "zustand";
import type { IconName } from "./icons";

export type ToastTone = "info" | "success" | "error" | "invite";

export type Toast = {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
  /** Overrides the tone's default icon. */
  icon?: IconName;
  /** ms; 0 keeps it until dismissed */
  duration: number;
};

type ToastStore = {
  toasts: Toast[];
  push: (t: Omit<Toast, "id" | "duration"> & { duration?: number }) => number;
  dismiss: (id: number) => void;
};

let seq = 0;

export const useToasts = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (t) => {
    const id = ++seq;
    const duration = t.duration ?? (t.tone === "invite" ? 0 : t.tone === "error" ? 6000 : 4000);
    set({ toasts: [...get().toasts.slice(-3), { ...t, id, duration }] });
    if (duration > 0) setTimeout(() => get().dismiss(id), duration);
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((x) => x.id !== id) }),
}));

/** Imperative helper usable from event handlers and query callbacks. */
export const toast = {
  info: (title: string, body?: string) => useToasts.getState().push({ tone: "info", title, body }),
  success: (title: string, body?: string) => useToasts.getState().push({ tone: "success", title, body }),
  error: (title: string, body?: string) => useToasts.getState().push({ tone: "error", title, body }),
  invite: (title: string, body: string, action: Toast["action"]) =>
    useToasts.getState().push({ tone: "invite", title, body, action }),
};