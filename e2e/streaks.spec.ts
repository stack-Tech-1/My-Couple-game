import { expect, test } from "@playwright/test";
import { admin, cleanup, clientAs, pairedRoom } from "./helpers";
import { forgivingStreak } from "../src/lib/progress/streak";

/**
 * The database's forgiving streak (room_streaks in 0030) against the same rules in TypeScript,
 * over random patterns of days together. Database only.
 */
test("forgiving streaks: the database agrees with the rules, day by day", async () => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  try {
    const c = await clientAs(a.email);
    // The database's "today" (UTC), so both sides use the same calendar.
    const today = new Date().toISOString().slice(0, 10);
    const dayAt = (back: number) => new Date(Date.parse(`${today}T12:00:00Z`) - back * 864e5).toISOString();
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    for (let round = 0; round < 4; round++) {
      await admin.from("solo_word_plays").delete().in("user_id", [a.id, b.id]);
      // 40 days back, each a day together about 80% of the time. Both finishing today's word
      // counts as a day together (no flood limits, unlike chat).
      const together: string[] = [];
      const rows: { user_id: string; day: string; finished_at: string; solved: boolean }[] = [];
      for (let back = 40; back >= 0; back--) {
        if (rand() > 0.8) continue;
        const day = dayAt(back).slice(0, 10);
        together.push(day);
        rows.push({ user_id: a.id, day, finished_at: dayAt(back), solved: true }, { user_id: b.id, day, finished_at: dayAt(back), solved: true });
      }
      const { error } = await admin.from("solo_word_plays").insert(rows);
      expect(error).toBeNull();
      const { data } = await c.rpc("room_progress", { p_room: roomId });
      const want = forgivingStreak(together, today);
      expect({ streak: data.streak, best: data.best_streak, rest: data.rest_used }, `round ${round}: ${together.join(" ")}`).toEqual({ streak: want.streak, best: want.best, rest: want.restUsed });
      expect(data.week.map((d: { status: string }) => d.status)).toEqual(want.week.map((d) => d.status));
    }
  } finally {
    await cleanup([a.id, b.id]);
  }
});
