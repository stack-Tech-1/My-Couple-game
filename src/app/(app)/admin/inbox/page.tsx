import Link from "next/link";
import { inboxCounts, listFeedback, listReports, listSuggestions } from "@/lib/admin/server";
import { FeedbackItem, ReportItem, SuggestionItem } from "@/components/admin/InboxItems";
import { cn } from "@/lib/cn";

const TABS = [
  { key: "feedback", label: "Feedback", statuses: [["new", "New"], ["in_progress", "In progress"], ["done", "Done"], ["wont_do", "Not planned"], ["all", "All"]] },
  { key: "suggestions", label: "Suggested cards", statuses: [["pending", "Waiting"], ["approved", "Approved"], ["rejected", "Rejected"], ["all", "All"]] },
  { key: "reports", label: "Reports", statuses: [["new", "New"], ["reviewing", "Reviewing"], ["resolved", "Resolved"], ["dismissed", "Dismissed"], ["all", "All"]] },
] as const;

export default async function AdminInbox({ searchParams }: { searchParams: Promise<{ tab?: string; status?: string }> }) {
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.tab) ?? TABS[0];
  const status = tab.statuses.some(([s]) => s === sp.status) ? sp.status! : tab.statuses[0][0];
  const counts = await inboxCounts();
  const badge = { feedback: counts.feedback, suggestions: counts.suggestions, reports: counts.reports } as Record<string, number>;

  const feedback = tab.key === "feedback" ? await listFeedback(status) : [];
  const suggestions = tab.key === "suggestions" ? await listSuggestions(status) : [];
  const reports = tab.key === "reports" ? await listReports(status) : [];
  const empty = !feedback.length && !suggestions.length && !reports.length;

  return (
    <div className="max-w-3xl">
      <h1 className="display text-[2.6rem] leading-none">Inbox</h1>
      <p className="mt-2 text-[0.9rem] text-muted">What people are telling you: feedback to answer, cards they&apos;ve suggested, and reports to review.</p>

      <nav aria-label="Inbox sections" className="mt-8 flex flex-wrap gap-2 border-b border-line pb-3">
        {TABS.map((t) => (
          <Link prefetch={false}
            key={t.key}
            href={`/admin/inbox?tab=${t.key}`}
            aria-current={t.key === tab.key ? "page" : undefined}
            className={cn("rounded-full px-3.5 py-1.5 text-[0.9rem] font-semibold", t.key === tab.key ? "bg-fg text-bg" : "text-muted hover:bg-sunk hover:text-fg")}
          >
            {t.label}
            {badge[t.key] ? <span className={cn("ml-1.5 rounded-full px-1.5 text-[0.72rem]", t.key === "reports" ? "bg-accent-ink text-bg" : "bg-accent text-on-accent")}>{badge[t.key]}</span> : null}
          </Link>
        ))}
      </nav>
      <nav aria-label="Status" className="mt-3 flex flex-wrap gap-1.5">
        {tab.statuses.map(([s, label]) => (
          <Link prefetch={false}
            key={s}
            href={`/admin/inbox?tab=${tab.key}&status=${s}`}
            aria-current={s === status ? "true" : undefined}
            className={cn("rounded-full px-3 py-1 text-[0.8rem] font-semibold", s === status ? "border border-line-strong" : "text-muted hover:text-fg")}
          >
            {label}
          </Link>
        ))}
      </nav>

      <ul className="mt-6 flex flex-col gap-4">
        {feedback.map((f) => (
          <FeedbackItem key={f.id} f={f} />
        ))}
        {suggestions.map((s) => (
          <SuggestionItem key={s.id} s={s} />
        ))}
        {reports.map((r) => (
          <ReportItem key={r.id} r={r} />
        ))}
      </ul>
      {empty ? <p className="py-12 text-center text-muted">Nothing here. {status === "new" || status === "pending" ? "You're all caught up." : ""}</p> : null}
    </div>
  );
}
