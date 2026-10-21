import { expect, test, type Page } from "@playwright/test";
import { admin, cleanup, clientAs, makeUser, signInPath } from "./helpers";

/**
 * Two real accounts in two isolated browsers against the real Supabase project:
 * sign-in → onboarding → invite/pair → live Connect Four (with a mid-game refresh)
 * → result + head-to-head → RLS probes → account deletion.
 */
test("two partners pair up and play Connect Four live", async ({ browser }) => {
  const a = await makeUser("ada");
  const b = await makeUser("bo");
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const errors: string[] = [];
  for (const [n, p] of [["A", pa], ["B", pb]] as const) {
    p.on("pageerror", (e) => errors.push(e.message));
    p.on("console", (msg) => msg.type() === "error" && console.log(`[${n} console]`, msg.text().slice(0, 300)));
  }

  try {
    // --- Ada signs in, onboards, opens a room
    await pa.goto(await signInPath(a.email, "/room"));
    await expect(pa).toHaveURL(/\/onboarding/);
    await pa.getByLabel("Your name").fill("Ada");
    // Can't continue without confirming 18+ and accepting the Terms.
    await expect(pa.getByRole("button", { name: "Next: your room" })).toBeDisabled();
    await pa.getByRole("checkbox", { name: /18 or older/ }).check();
    await pa.getByRole("button", { name: "Next: your room" }).click();
    await pa.getByLabel("Room name").fill("The Den");
    await pa.getByRole("button", { name: "Open the room" }).click();
    await expect(pa).toHaveURL(/\/room\/[0-9a-f-]{36}$/);
    await expect(pa.getByText("Your room is ready. It's missing someone.")).toBeVisible();

    // A brand-new person gets the welcome tour once, on their room home. Ada walks through it.
    const tour = pa.getByRole("dialog", { name: "This is your room" });
    await expect(tour).toBeVisible();
    await tour.getByRole("button", { name: "Next" }).click();
    await expect(pa.getByRole("dialog", { name: "Invite your person" })).toBeVisible();
    for (let i = 0; i < 6; i++) {
      const done = pa.getByRole("button", { name: "Done" });
      if (await done.isVisible()) break;
      await pa.getByRole("button", { name: "Next" }).click();
    }
    await pa.getByRole("button", { name: "Done" }).click();
    await expect(pa.getByRole("dialog", { name: /Settings/ })).toHaveCount(0);
    await expect.poll(async () => (await admin.from("profiles").select("tour").eq("id", a.id).single()).data?.tour).toBe("done");
    // The Getting started list is there, with nothing ticked yet.
    await expect(pa.getByText("0 of 4 done")).toBeVisible();

    const { data: m } = await admin.from("room_members").select("room_id").eq("user_id", a.id).single();
    const { data: room } = await admin.from("rooms").select("id, invite_code").eq("id", m!.room_id).single();
    const code = room!.invite_code as string;
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    // --- Bo follows the invite link
    await pb.goto(await signInPath(b.email, `/join/${code}`));
    await expect(pb).toHaveURL(/\/onboarding\?next=/);
    await pb.getByLabel("Your name").fill("Bo");
    await pb.getByRole("checkbox", { name: /18 or older/ }).check();
    await pb.getByRole("button", { name: "Continue to your invite" }).click();
    await expect(pb.getByText(/saved you a seat in/)).toBeVisible();
    await pb.getByRole("button", { name: "Take the seat" }).click();
    await expect(pb).toHaveURL(new RegExp(`/room/${room!.id}$`));
    await pb.getByRole("button", { name: "Skip tour" }).click();

    // Pairing retires the code and Ada's room updates live (no reload).
    const { data: paired } = await admin.from("rooms").select("invite_code, paired_at").eq("id", room!.id).single();
    expect(paired!.invite_code).toBeNull();
    expect(paired!.paired_at).not.toBeNull();
    await expect(pa.getByText("Your room is ready. It's missing someone.")).toBeHidden();
    await expect(pa.getByRole("img", { name: /Bo, online/ })).toBeVisible();

    // --- Ada invites Bo to Connect Four; Bo joins from the toast
    await pa.goto(`/room/${room!.id}/games/connect-four`);
    await pa.getByRole("button", { name: "Invite Bo" }).click();
    await expect(pa).toHaveURL(/\/play\//);
    await pb.getByRole("button", { name: "Join" }).click();
    await expect(pb).toHaveURL(pa.url());

    // Whoever the seed picked goes first. First player builds a bottom row 0..3.
    const firstIsAda = await pa.getByRole("button", { name: /^Column 1/ }).isEnabled({ timeout: 20_000 }).catch(() => false);
    const [first, second] = firstIsAda ? [pa, pb] : [pb, pa];
    await expect(first.getByRole("button", { name: /^Column 1/ })).toBeEnabled();

    const drop = async (p: Page, col: number, other: Page) => {
      await expect(p.getByRole("button", { name: new RegExp(`^Column ${col + 1}`) })).toBeEnabled();
      const [res] = await Promise.all([
        p.waitForResponse((r) => r.url().includes("/move")),
        p.getByRole("button", { name: new RegExp(`^Column ${col + 1}`) }).click(),
      ]);
      if (!res.ok()) throw new Error(`move failed ${res.status()}: ${await res.text()}`);
      // the move must reach the other browser over realtime
      await expect(other.getByRole("group", { name: /Connect Four board/ })).toHaveAttribute("aria-label", /Your move|found four|Yours/);
    };

    await drop(first, 0, second);
    await drop(second, 0, first);
    await drop(first, 1, second);

    // Mid-game refresh: the second player reloads and resumes exactly where they were.
    await second.reload();
    await expect(second.getByRole("button", { name: "Column 1, 4 spaces free" })).toBeEnabled();
    await expect(second.getByRole("button", { name: "Column 2, 5 spaces free" })).toBeEnabled();

    await drop(second, 1, first);
    await drop(first, 2, second);
    await drop(second, 2, first);
    await first.getByRole("button", { name: /^Column 4/ }).click();

    await expect(first.getByRole("heading", { name: "You won." })).toBeVisible();
    await expect(second.getByRole("heading", { name: `${firstIsAda ? "Ada" : "Bo"} won.` })).toBeVisible();

    // Head-to-head reflects the win on the dashboard.
    await pa.goto(`/room/${room!.id}`);
    await expect(pa.getByLabel(firstIsAda ? "Ada: 1 wins" : "Bo: 1 wins")).toBeVisible();

    // --- RLS probes with Bo's own session
    const asBo = await clientAs(b.email);
    const { data: secrets } = await asBo.from("game_secrets").select("*");
    expect(secrets ?? []).toHaveLength(0);
    const { data: moves } = await asBo.from("game_moves").select("*");
    expect(moves ?? []).toHaveLength(0);
    const { data: views } = await asBo.from("game_views").select("user_id");
    expect((views ?? []).every((v) => v.user_id === b.id)).toBe(true);
    const { error: forgeErr } = await asBo.from("game_views").update({ view: {} }).eq("user_id", b.id).select();
    const { data: after } = await admin.from("game_views").select("view").eq("user_id", b.id).limit(1).single();
    expect(forgeErr === null ? after!.view : {}).not.toEqual({});
    const { error: rpcErr } = await asBo.rpc("commit_game_move", {});
    expect(rpcErr).not.toBeNull();

    // --- Bo deletes their account through the UI; Ada keeps the room with a fresh code.
    await pb.goto(`/room/${room!.id}/settings`);
    await pb.getByRole("button", { name: "Delete my account" }).click();
    await pb.getByLabel('Type "delete" to confirm').fill("delete");
    await pb.getByRole("button", { name: "Delete forever" }).click();
    await expect(pb).toHaveURL(/\/\?deleted=1/);
    const { data: gone } = await admin.auth.admin.getUserById(b.id);
    expect(gone.user).toBeNull();
    const { data: left } = await admin.from("rooms").select("invite_code, paired_at").eq("id", room!.id).single();
    expect(left!.paired_at).toBeNull();
    expect(left!.invite_code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);

    expect(errors).toEqual([]);
  } finally {
    await cleanup([a.id, b.id]);
    await ctxA.close();
    await ctxB.close();
  }
});