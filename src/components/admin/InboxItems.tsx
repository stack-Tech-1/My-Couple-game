"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/design/Button";
import { toast } from "@/design/toast";
import { cn } from "@/lib/cn";
import { approveSuggestion, rejectSuggestion, replyAsTeam, updateFeedback, updateReport } from "@/lib/admin/inbox-actions";
import type { AdminFeedback, AdminReport, AdminSuggestion } from "@/lib/admin/server";
import { FEEDBACK_KIND_LABEL, FEEDBACK_STATUS_LABEL, FEEDBACK_STATUSES, REPORT_STATUSES, type FeedbackKind, type FeedbackStatus } from "@/lib/feedback/types";
import { REPORT_LABELS, type ReportReason } from "@/lib/room/types";

const GAME_STATUS: Record<string, string> = { active: "still going", finished: "finished", abandoned: "ended early" };

/** How long before `to` the time `from` was, roughly: "4 min", "2 hr", "3 days". */
function ago(from: string, to: string): string {
  const min = Math.max(0, Math.round((Date.parse(to) - Date.parse(from)) / 60_000));
  if (min < 60) return `${min} min`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr} hr`;
  return `${Math.round(hr / 24)} days`;
}

const when = (iso: string) => new Date(iso).toLocaleString(undefined, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const manage = (email: string | null) => (email ? `/admin/users?email=${encodeURIComponent(email)}#manage` : null);
const REPORT_STATUS_LABEL: Record<string, string> = { new: "New", reviewing: "Reviewing", resolved: "Resolved", dismissed: "Dismissed" };
const SUGGEST_LABEL: Record<string, string> = {
  daily_question: "Daily Question",
  this_or_that: "This or That",
  deep_question: "Deep Question",
  date_idea: "Date idea",
  truth: "Truth (After Dark)",
  dare: "Dare (After Dark)",
  never: "Never Have I Ever (After Dark)",
};

function useAct() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "That didn't work.");
      if (ok) toast.success(ok);
      router.refresh();
    });
  return { pending, run };
}

function Note({ value, onSave }: { value: string | null; onSave: (v: string) => void }) {
  const [v, setV] = useState(value ?? "");
  return (
    <label className="mt-3 block">
      <span className="text-[0.75rem] font-semibold text-muted">Private note (only admins see this)</span>
      <textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => v !== (value ?? "") && onSave(v)}
        rows={2}
        maxLength={2000}
        className="mt-1 w-full rounded-[12px] border-[1.5px] border-line bg-bg px-3 py-2 text-[0.88rem] focus:border-line-strong focus:outline-none"
      />
    </label>
  );
}

export function FeedbackItem({ f }: { f: AdminFeedback }) {
  const { pending, run } = useAct();
  const [reply, setReply] = useState("");
  const link = manage(f.email);

  function send(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      const res = await replyAsTeam(f.id, reply);
      if (res.ok) setReply("");
      return res;
    }, "Reply sent.");
  }

  return (
    <li className="rounded-[18px] border border-line bg-raised p-5">
      <div className="flex flex-wrap items-center gap-2 text-[0.78rem]">
        <span className="rounded-full bg-sunk px-2 py-0.5 font-semibold">{FEEDBACK_KIND_LABEL[f.kind as FeedbackKind] ?? f.kind}</span>
        <span className="text-muted">{when(f.created_at)}</span>
        <span className="text-muted">·</span>
        {link ? (
          <Link prefetch={false} href={link} className="font-semibold hover:underline">
            {f.email}
          </Link>
        ) : (
          <span className="text-muted">Deleted account</span>
        )}
        <label className="ml-auto">
          <span className="sr-only">Status</span>
          <select
            value={f.status}
            disabled={pending}
            onChange={(e) => run(() => updateFeedback(f.id, { status: e.target.value }))}
            className="h-8 rounded-full border border-line bg-bg px-2 text-[0.8rem] font-semibold"
          >
            {FEEDBACK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {FEEDBACK_STATUS_LABEL[s as FeedbackStatus]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-3 text-[0.82rem] text-muted">
        {f.last_game ? (
          <>
            Last game: <b className="text-fg">{f.last_game.name}</b> · {GAME_STATUS[f.last_game.status] ?? f.last_game.status} · started {ago(f.last_game.started_at, f.created_at)} before this
          </>
        ) : (
          "No games played before this."
        )}
      </p>
      <p className="mt-2 whitespace-pre-wrap">{f.body}</p>
      {f.screenshot_url ? (
        <a href={f.screenshot_url} target="_blank" rel="noreferrer" className="mt-3 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element -- signed, short-lived */}
          <img src={f.screenshot_url} alt="Screenshot attached to this feedback" className="max-h-48 rounded-[10px] border border-line" />
        </a>
      ) : null}
      {Object.keys(f.meta ?? {}).length ? (
        <details className="mt-3 text-[0.8rem]">
          <summary className="cursor-pointer text-muted">Device details</summary>
          <dl className="mt-2 grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1">
            {Object.entries(f.meta).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="break-all">{String(v)}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
      {f.replies.length ? (
        <ol className="mt-4 flex flex-col gap-2 border-t border-line pt-3">
          {f.replies.map((r) => (
            <li key={r.id} className={cn("rounded-[12px] px-3 py-2 text-[0.9rem]", r.from_team ? "ml-6 bg-sunk" : "border border-line")}>
              <p className="text-[0.72rem] font-semibold text-muted">
                {r.from_team ? "Team" : "Them"} · {when(r.created_at)}
              </p>
              <p className="mt-0.5 whitespace-pre-wrap">{r.body}</p>
            </li>
          ))}
        </ol>
      ) : null}
      {f.user_id ? (
        <form onSubmit={send} className="mt-4">
          <label className="block">
            <span className="text-[0.75rem] font-semibold text-muted">Reply (they&apos;ll see it in Amah, and by email if email is set up)</span>
            <textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              maxLength={2000}
              className="mt-1 w-full rounded-[12px] border-[1.5px] border-line bg-bg px-3 py-2 text-[0.92rem] focus:border-line-strong focus:outline-none"
            />
          </label>
          <div className="mt-2 flex justify-end">
            <Button type="submit" size="sm" loading={pending} disabled={!reply.trim()}>
              Send reply
            </Button>
          </div>
        </form>
      ) : null}
      <Note value={f.admin_note} onSave={(v) => run(() => updateFeedback(f.id, { admin_note: v }))} />
    </li>
  );
}

function summary(kind: string, b: Record<string, unknown>): string {
  if (kind === "this_or_that") return `${b.a} / ${b.b}`;
  if (kind === "date_idea") return `${b.title}: ${b.detail}`;
  if (kind === "deep_question") return `${["Warm-up", "Getting real", "The deep end"][Number(b.level)] ?? ""}: ${b.text}`;
  const heat = typeof b.heat === "number" ? ` (${["", "Warm", "Hot", "Fire"][b.heat]})` : "";
  return `${b.text ?? ""}${heat}`;
}

export function SuggestionItem({ s }: { s: AdminSuggestion }) {
  const { pending, run } = useAct();
  return (
    <li className="flex flex-wrap items-start gap-4 rounded-[18px] border border-line bg-raised p-4">
      <div className="min-w-0 flex-1">
        <p className="text-[0.75rem] font-semibold uppercase tracking-wide text-muted">{SUGGEST_LABEL[s.kind] ?? s.kind}</p>
        <p className="mt-1">{summary(s.kind, s.body)}</p>
        <p className="mt-1 text-[0.78rem] text-muted">
          {s.email ?? "Deleted account"} · {when(s.created_at)}
        </p>
      </div>
      {s.status === "pending" ? (
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => run(() => rejectSuggestion(s.id))} disabled={pending}>
            Reject
          </Button>
          <Button size="sm" onClick={() => run(() => approveSuggestion(s.id), "Added to the deck.")} loading={pending}>
            Approve
          </Button>
        </div>
      ) : (
        <span className={cn("rounded-full px-2.5 py-1 text-[0.75rem] font-semibold", s.status === "approved" ? "bg-[color-mix(in_srgb,var(--sage)_25%,transparent)]" : "bg-sunk text-muted")}>
          {s.status === "approved" ? "Approved" : "Rejected"}
        </span>
      )}
    </li>
  );
}

export function ReportItem({ r }: { r: AdminReport }) {
  const { pending, run } = useAct();
  const reported = manage(r.reported_email);
  return (
    <li className="rounded-[18px] border-[1.5px] border-line bg-raised p-5">
      <div className="flex flex-wrap items-center gap-2 text-[0.78rem]">
        <span className="rounded-full bg-accent-ink px-2 py-0.5 font-semibold text-bg">{REPORT_LABELS[r.reason as ReportReason] ?? r.reason}</span>
        <span className="text-muted">{when(r.created_at)}</span>
        <span className="ml-auto rounded-full bg-sunk px-2 py-0.5 font-semibold">{REPORT_STATUS_LABEL[r.status] ?? r.status}</span>
      </div>
      <dl className="mt-3 grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1 text-[0.88rem]">
        <dt className="text-muted">Reported</dt>
        <dd>
          {reported ? (
            <Link prefetch={false} href={reported} className="font-semibold hover:underline">
              {r.reported_email}
            </Link>
          ) : (
            "Deleted account"
          )}
        </dd>
        <dt className="text-muted">By</dt>
        <dd>{r.reporter_email ?? "Deleted account"}</dd>
      </dl>
      {r.details ? <p className="mt-3 whitespace-pre-wrap text-[0.92rem]">“{r.details}”</p> : null}
      {r.message_snapshot ? (
        <div className="mt-3 rounded-[12px] border-l-4 border-accent-ink bg-sunk px-3 py-2 text-[0.9rem]">
          <p className="text-[0.72rem] font-semibold text-muted">Reported message{r.message_snapshot.created_at ? ` · ${when(r.message_snapshot.created_at)}` : ""}</p>
          <p className="mt-0.5 whitespace-pre-wrap">{r.message_snapshot.kind === "text" ? r.message_snapshot.body : r.message_snapshot.kind === "voice" ? "(a voice note)" : "(a sticker)"}</p>
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {REPORT_STATUSES.filter((st) => st !== r.status && st !== "new").map((st) => (
          <Button key={st} size="sm" variant={st === "resolved" ? "primary" : "ghost"} onClick={() => run(() => updateReport(r.id, { status: st }))} disabled={pending}>
            Mark {REPORT_STATUS_LABEL[st]!.toLowerCase()}
          </Button>
        ))}
        {reported ? (
          <Link prefetch={false} href={reported} className="inline-flex h-9 items-center rounded-full px-4 text-[0.85rem] font-semibold text-accent-ink hover:bg-sunk">
            Suspend or delete…
          </Link>
        ) : null}
      </div>
      <Note value={r.admin_note} onSave={(v) => run(() => updateReport(r.id, { admin_note: v }))} />
    </li>
  );
}
