"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/design/Button";
import { Tabs } from "@/design/Tabs";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { markFeedbackSeen, replyToFeedback } from "@/lib/feedback/actions";
import { FEEDBACK_KIND_LABEL, FEEDBACK_STATUS_LABEL, type FeedbackThread } from "@/lib/feedback/types";
import { FeedbackForm } from "./FeedbackForm";
import { SuggestForm } from "./SuggestForm";

const when = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });

function Thread({ t }: { t: FeedbackThread }) {
  const router = useRouter();
  const [reply, setReply] = useState("");
  const [pending, start] = useTransition();
  const lastFromTeam = t.replies.findLast((r) => r.from_team);

  function send(e: FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await replyToFeedback(t.id, reply);
      if (!res.ok) return void toast.error(res.error);
      setReply("");
      router.refresh();
    });
  }

  return (
    <li className="rounded-[16px] border border-line bg-raised p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-[0.78rem]">
        <span className="font-semibold uppercase tracking-wide text-muted">{FEEDBACK_KIND_LABEL[t.kind]}</span>
        <span className={cn("rounded-full px-2 py-0.5 font-semibold", t.status === "done" ? "bg-[color-mix(in_srgb,var(--sage)_25%,transparent)]" : "bg-sunk")}>{FEEDBACK_STATUS_LABEL[t.status]}</span>
      </div>
      <p className="mt-2 whitespace-pre-wrap text-[0.92rem]">{t.body}</p>
      <p className="mt-1 text-[0.75rem] text-muted">{when(t.created_at)}</p>
      {t.replies.length ? (
        <ol className="mt-3 flex flex-col gap-2 border-t border-line pt-3">
          {t.replies.map((r) => (
            <li key={r.id} className={cn("rounded-[12px] px-3 py-2 text-[0.9rem]", r.from_team ? "bg-sunk" : "ml-6 border border-line")}>
              <p className="text-[0.72rem] font-semibold text-muted">{r.from_team ? "The Amah team" : "You"} · {when(r.created_at)}</p>
              <p className="mt-0.5 whitespace-pre-wrap">{r.body}</p>
            </li>
          ))}
        </ol>
      ) : null}
      {lastFromTeam ? (
        <form onSubmit={send} className="mt-3 flex gap-2">
          <label className="sr-only" htmlFor={`reply-${t.id}`}>
            Reply
          </label>
          <input
            id={`reply-${t.id}`}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            maxLength={2000}
            placeholder="Reply…"
            className="h-10 min-w-0 flex-1 rounded-full border-[1.5px] border-line bg-bg px-4 text-[0.92rem] focus:border-line-strong focus:outline-none"
          />
          <Button type="submit" size="sm" loading={pending} disabled={!reply.trim()}>
            Send
          </Button>
        </form>
      ) : null}
    </li>
  );
}

/** Settings → Help & feedback: send feedback, suggest a card, and read the team's replies. */
export function FeedbackHub({ userId, threads, unread, spicyOpen }: { userId: string; threads: FeedbackThread[]; unread: number; spicyOpen: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<"send" | "suggest" | "mine">(unread ? "mine" : "send");

  useEffect(() => {
    if (tab === "mine" && unread) void markFeedbackSeen().then(() => router.refresh());
  }, [tab, unread, router]);

  return (
    <div className="flex flex-col gap-5">
      <Tabs
        label="Help and feedback"
        value={tab}
        onChange={setTab}
        items={[
          { key: "send", label: "Send feedback" },
          { key: "suggest", label: "Suggest a card" },
          {
            key: "mine",
            label: (
              <>
                Your messages
                {unread ? <span className="ml-1.5 rounded-full bg-accent px-1.5 text-[0.72rem] text-on-accent">{unread}</span> : threads.length ? <span className="ml-1.5 text-muted">{threads.length}</span> : null}
              </>
            ),
          },
        ]}
      />
      {tab === "send" ? (
        <FeedbackForm userId={userId} onSent={() => router.refresh()} />
      ) : tab === "suggest" ? (
        <SuggestForm spicyOpen={spicyOpen} />
      ) : threads.length ? (
        <ul className="flex flex-col gap-3">
          {threads.map((t) => (
            <Thread key={t.id} t={t} />
          ))}
        </ul>
      ) : (
        <p className="py-6 text-center text-muted">Nothing yet. When you send feedback, our replies show up here.</p>
      )}
    </div>
  );
}
