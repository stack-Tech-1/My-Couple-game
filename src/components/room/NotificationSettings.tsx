"use client";

import { useEffect, useState, useTransition } from "react";
import { Button } from "@/design/Button";
import { Toggle } from "@/design/Field";
import { toast } from "@/design/toast";
import { currentSubscription, disablePush, enablePush, pushSupport, type PushSupport } from "@/lib/push/client";
import { sendTestPush, setPushPrefs } from "@/lib/push/actions";
import { PUSH_KINDS, PUSH_LABEL, type PushPrefs } from "@/lib/push/types";

type State = "loading" | "on" | "off" | "denied" | PushSupport;

export function NotificationSettings({ publicKey, prefs: initial }: { publicKey: string | null; prefs: PushPrefs }) {
  const [state, setState] = useState<State>("loading");
  const [prefs, setPrefs] = useState(initial);
  const [pending, start] = useTransition();

  useEffect(() => {
    const support = pushSupport();
    if (support !== "ok") return setState(support);
    if (Notification.permission === "denied") return setState("denied");
    void currentSubscription().then((s) => setState(s ? "on" : "off"));
  }, []);

  function enable() {
    if (!publicKey) return void toast.error("Notifications aren't set up on the server yet.");
    start(async () => {
      const res = await enablePush(publicKey);
      if (res.ok) {
        setState("on");
        toast.success("Notifications are on for this device.");
      } else if (res.reason === "denied") setState("denied");
      else toast.error("Couldn't turn notifications on.", res.error);
    });
  }

  function disable() {
    start(async () => {
      await disablePush();
      setState("off");
    });
  }

  function toggle(k: keyof PushPrefs, v: boolean) {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    void setPushPrefs(next).then((r) => {
      if (!r.ok) {
        setPrefs(prefs);
        toast.error(r.error);
      }
    });
  }

  return (
    <div>
      <div className="rounded-[16px] border border-line bg-raised p-4">
        {state === "loading" ? (
          <p className="text-muted">Checking this device…</p>
        ) : state === "on" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p>
              <span className="font-semibold">On for this device.</span>{" "}
              <span className="text-muted">You&apos;ll only hear from us when you&apos;re not already in Amah.</span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  start(async () => {
                    const r = await sendTestPush();
                    if (r.ok && r.data.sent) toast.success("Test sent.", "It should pop up in a moment.");
                    else toast.error("That didn't reach this device.", "Try turning notifications off and on again.");
                  })
                }
                disabled={pending}
              >
                Send a test
              </Button>
              <Button variant="outline" size="sm" onClick={disable} loading={pending}>
                Turn off
              </Button>
            </div>
          </div>
        ) : state === "off" ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted">Get a ping when it&apos;s your turn, a message arrives, or your partner is thinking of you.</p>
            <Button onClick={enable} loading={pending}>
              Turn on notifications
            </Button>
          </div>
        ) : state === "ios-install" ? (
          <p className="text-muted">
            On iPhone, notifications only work once Amah is on your Home Screen: in Safari, tap <span className="font-semibold text-fg">Share</span> then{" "}
            <span className="font-semibold text-fg">Add to Home Screen</span>, open Amah from there, and come back here.
          </p>
        ) : state === "denied" ? (
          <p className="text-muted">Notifications are blocked for Amah in this browser. Allow them in your browser or phone settings for this site, then reload.</p>
        ) : (
          <p className="text-muted">This browser can&apos;t show notifications. Try Chrome on Android, or Amah added to your iPhone&apos;s Home Screen.</p>
        )}
      </div>
      <div className="mt-2">
        {PUSH_KINDS.map((k) => (
          <Toggle key={k} checked={prefs[k]} onChange={(v) => toggle(k, v)} label={PUSH_LABEL[k].label} description={PUSH_LABEL[k].description} />
        ))}
      </div>
    </div>
  );
}
