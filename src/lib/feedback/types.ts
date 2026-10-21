export const FEEDBACK_KINDS = ["bug", "idea", "complaint", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];
export const FEEDBACK_KIND_LABEL: Record<FeedbackKind, string> = {
  bug: "Something's broken",
  idea: "An idea",
  complaint: "A complaint",
  other: "Something else",
};

export const FEEDBACK_STATUSES = ["new", "in_progress", "done", "wont_do"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];
export const FEEDBACK_STATUS_LABEL: Record<FeedbackStatus, string> = {
  new: "Received",
  in_progress: "Looking into it",
  done: "Done",
  wont_do: "Not planned",
};

export type FeedbackReply = { id: string; from_team: boolean; body: string; created_at: string };
export type FeedbackThread = {
  id: string;
  kind: FeedbackKind;
  body: string;
  status: FeedbackStatus;
  created_at: string;
  updated_at: string;
  replies: FeedbackReply[];
};

/** Cards people can suggest. After Dark kinds only show for rooms where it's open. */
export const SUGGEST_KINDS = [
  { kind: "daily_question", label: "Daily Question", spicy: false },
  { kind: "this_or_that", label: "This or That", spicy: false },
  { kind: "deep_question", label: "Deep Question", spicy: false },
  { kind: "date_idea", label: "Date idea", spicy: false },
  { kind: "truth", label: "Truth (After Dark)", spicy: true },
  { kind: "dare", label: "Dare (After Dark)", spicy: true },
  { kind: "never", label: "Never Have I Ever (After Dark)", spicy: true },
] as const;
export type SuggestKind = (typeof SUGGEST_KINDS)[number]["kind"];

export const REPORT_STATUSES = ["new", "reviewing", "resolved", "dismissed"] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];
