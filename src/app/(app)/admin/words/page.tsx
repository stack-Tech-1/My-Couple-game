import { supabaseAdmin } from "@/lib/supabase/server";
import { lagosDay } from "@/lib/solo/catalog";
import { upcomingWords } from "@/lib/solo/oro-days";
import { WordDays } from "@/components/admin/WordDays";

export default async function AdminWords() {
  const today = lagosDay();
  const [days, { count }] = await Promise.all([
    upcomingWords(today, 14),
    supabaseAdmin().from("solo_word_plays").select("user_id", { count: "exact", head: true }).eq("day", today),
  ]);
  return (
    <div className="max-w-3xl">
      <h1 className="display text-[2.6rem] leading-none">Today&apos;s word</h1>
      <p className="mt-2 text-[0.9rem] text-muted">
        Ọ̀rọ̀ of the Day for the next two weeks. Fridays are Naija words. Change any day to your own word (a Naija word needs a hint), or undo to go back to the built-in list. Only
        admins can see this page; players never see a word before they finish it.
      </p>
      <WordDays days={days} today={today} plays={count ?? 0} />
    </div>
  );
}
