export type Note = { id: string; author_id: string; recipient_id: string; body: string; stationery: Stationery; unlock_at: string | null; opened_at: string | null; created_at: string };
export type SealedNote = { id: string; author_id: string; stationery: Stationery; unlock_at: string; created_at: string };
export type Stationery = "paper" | "wine" | "sage" | "brass";
export type NotesState = { inbox: Note[]; sealed: SealedNote[]; sent: Note[] };

export type Memory = {
  id: string;
  author_id: string;
  path: string;
  prompt: string;
  taken_on: string | null;
  answer: string | null;
  answered_by: string | null;
  created_at: string;
  /** Short-lived signed URL; never a public link. */
  url: string | null;
};

export type BucketCategory = "adventure" | "travel" | "home" | "food" | "learn" | "someday";
export type BucketItem = { id: string; title: string; note: string | null; category: BucketCategory; created_by: string | null; done_at: string | null; done_by: string | null; created_at: string };