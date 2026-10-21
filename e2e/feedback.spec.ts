import { expect, test } from "@playwright/test";
import { admin, cleanup, clientAs, makeUser, pairedRoom, signInPath } from "./helpers";

const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==", "base64");

/** Feedback, replies and suggestions stay between the person and the team. */
test("feedback and suggestions hold up against direct access", async () => {
  const { a, b } = await pairedRoom(["Ada", "Bo"]);
  const eve = await makeUser("eve");
  try {
    const ca = await clientAs(a.email);
    const ce = await clientAs(eve.email);

    const { data: fb, error } = await ca.from("feedback").insert({ user_id: a.id, kind: "bug", body: "Rematch did nothing" }).select("id").single();
    expect(error).toBeNull();
    // Can't send as someone else, pre-resolve it, or attach someone else's file.
    expect((await ca.from("feedback").insert({ user_id: b.id, kind: "idea", body: "pretending" })).error).not.toBeNull();
    expect((await ca.from("feedback").insert({ user_id: a.id, kind: "idea", body: "sneaky", status: "done" })).error).not.toBeNull();
    expect((await ca.from("feedback").insert({ user_id: a.id, kind: "idea", body: "their file", screenshot_path: `${b.id}/x.jpg` })).error).not.toBeNull();
    // Screenshots only in your own folder.
    expect((await ca.storage.from("feedback").upload(`${a.id}/s.png`, PNG, { contentType: "image/png" })).error).toBeNull();
    expect((await ca.storage.from("feedback").upload(`${b.id}/s.png`, PNG, { contentType: "image/png" })).error).not.toBeNull();
    expect((await ce.storage.from("feedback").download(`${a.id}/s.png`)).error).not.toBeNull();
    // Others see nothing; nobody can fake a team reply.
    expect((await ce.from("feedback").select("id")).data).toEqual([]);
    expect((await ca.from("feedback_replies").insert({ feedback_id: fb!.id, from_team: true, author_id: a.id, body: "fixed!" })).error).not.toBeNull();
    expect((await ce.from("feedback_replies").insert({ feedback_id: fb!.id, from_team: false, author_id: eve.id, body: "hi" })).error).not.toBeNull();
    expect((await ca.from("feedback_replies").insert({ feedback_id: fb!.id, from_team: false, author_id: a.id, body: "Still broken" })).error).toBeNull();
    // Suggestions: your own, pending only.
    expect((await ca.from("suggestions").insert({ user_id: a.id, kind: "daily_question", body: { text: "Hi?" } })).error).toBeNull();
    expect((await ca.from("suggestions").insert({ user_id: a.id, kind: "daily_question", body: { text: "Hi?" }, status: "approved" })).error).not.toBeNull();
    expect((await ce.from("suggestions").select("id")).data).toEqual([]);
    // The user list is admin-only.
    expect((await ca.rpc("admin_list_users", {})).error).not.toBeNull();
  } finally {
    await admin.storage.from("feedback").remove([`${a.id}/s.png`]);
    await cleanup([a.id, b.id, eve.id]);
  }
});

test("feedback loop, suggestions, reports and the user list, in two browsers", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  await admin.from("app_admins").insert({ user_id: a.id });
  const startedAt = new Date().toISOString();
  const ctxA = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));
  const SHOTS = process.env.SHOTS_DIR;
  const bug = `E2E bug ${Date.now()}: the dice froze after a rematch`;
  const dish = `Jollof ${Date.now() % 100000}`;

  try {
    // --- Bo sends feedback with a screenshot, and suggests a card.
    await pb.goto(await signInPath(b.email, `/room/${roomId}/settings#feedback`));
    const hub = pb.locator("#feedback");
    await hub.getByText("Something's broken").click();
    await hub.getByLabel(/What happened/).fill(bug);
    await hub.locator('input[type="file"]').setInputFiles({ name: "shot.png", mimeType: "image/png", buffer: PNG });
    await hub.getByRole("button", { name: "Send", exact: true }).click();
    await expect(pb.getByText("Thank you. We read every one.")).toBeVisible();

    await hub.getByRole("tab", { name: "Suggest a card" }).click();
    await hub.getByLabel("What kind of card?").selectOption("this_or_that");
    await hub.getByLabel("This", { exact: true }).fill(dish);
    await hub.getByLabel("Or that", { exact: true }).fill("Fried rice");
    await hub.getByRole("button", { name: "Suggest it" }).click();
    await expect(pb.getByText("Suggestion sent.")).toBeVisible();

    // --- Ada (admin) sees it in the inbox, replies, and approves the suggestion.
    await pa.goto(await signInPath(a.email, "/admin/inbox"));
    await expect(pa.getByRole("link", { name: /^Inbox/ })).toContainText(/\d/);
    const item = pa.getByRole("listitem").filter({ hasText: bug });
    await expect(item).toBeVisible();
    await expect(item.getByRole("img", { name: "Screenshot attached to this feedback" })).toBeVisible();
    await item.getByText("Device details").click();
    await expect(item.getByText("page")).toBeVisible();
    await item.getByRole("textbox", { name: /Reply/ }).fill("Thanks Bo, fixing it this week.");
    await item.getByRole("button", { name: "Send reply" }).click();
    // Replying moves it out of "New" into "In progress".
    await expect(item).toBeHidden();
    await pa.goto("/admin/inbox?tab=feedback&status=in_progress");
    const answered = pa.getByRole("listitem").filter({ hasText: bug });
    await expect(answered.getByText("Thanks Bo, fixing it this week.")).toBeVisible();
    await expect(answered.getByRole("combobox", { name: "Status" })).toHaveValue("in_progress");
    if (SHOTS) await pa.screenshot({ path: `${SHOTS}/admin-inbox.png`, fullPage: true });

    await pa.getByRole("link", { name: /^Suggested cards/ }).click();
    const sug = pa.getByRole("listitem").filter({ hasText: `${dish} / Fried rice` });
    await sug.getByRole("button", { name: "Approve" }).click();
    await expect(pa.getByText("Added to the deck.")).toBeVisible();
    const { data: added } = await admin.from("content_items").select("body").eq("kind", "this_or_that").gte("created_at", startedAt);
    expect(added!.map((r) => r.body)).toContainEqual({ a: dish, b: "Fried rice" });

    // --- Bo gets the dot on Settings and reads the reply.
    await pb.goto(`/room/${roomId}`);
    await expect(pb.getByRole("link", { name: "Room settings, new reply from the Amah team" })).toBeVisible();
    await pb.getByRole("link", { name: "Room settings, new reply from the Amah team" }).click();
    await expect(pb.getByText("Thanks Bo, fixing it this week.")).toBeVisible();
    await pb.getByLabel("Reply", { exact: true }).fill("Brilliant, thank you!");
    await pb.getByRole("button", { name: "Send", exact: true }).click();
    await expect(pb.getByText("Brilliant, thank you!")).toBeVisible();
    await pb.goto(`/room/${roomId}`);
    await expect(pb.getByRole("link", { name: "Room settings", exact: true })).toBeVisible();

    // --- A report shows up and can be resolved.
    const cb = await clientAs(b.email);
    await cb.rpc("file_report", { p_reason: "spam", p_details: "E2E report" });
    await pa.goto("/admin/inbox?tab=reports");
    const rep = pa.getByRole("listitem").filter({ hasText: "E2E report" });
    await expect(rep).toContainText(a.email);
    await rep.getByRole("button", { name: "Mark resolved" }).click();
    await expect(rep).toBeHidden();

    // --- The user list shows pairs; search and filter work; Manage opens the account.
    await pa.goto(`/admin/users?q=${encodeURIComponent(b.email)}`);
    // Searching Bo's email finds Bo, and Ada too (as Bo's partner). Bo's own row names Ada.
    await expect(pa.getByRole("row").filter({ hasText: b.email })).toHaveCount(2);
    const row = pa.getByRole("row").filter({ has: pa.getByRole("link", { name: `Manage ${b.email}` }) });
    await expect(row).toContainText("Ada");
    await expect(row).toContainText(a.email);
    await pa.goto("/admin/users?filter=admins");
    await expect(pa.getByRole("link", { name: `Manage ${a.email}` })).toBeVisible();
    await expect(pa.getByRole("link", { name: `Manage ${b.email}` })).toHaveCount(0);
    await pa.goto(`/admin/users?q=${encodeURIComponent(b.email)}`);
    await pa.getByRole("link", { name: `Manage ${b.email}` }).click();
    await expect(pa.locator("#manage").getByText("Paired with a partner")).toBeVisible();
    if (SHOTS) await pa.screenshot({ path: `${SHOTS}/admin-users-list.png`, fullPage: true });

    expect(errors).toEqual([]);
  } finally {
    await admin.from("content_items").delete().gte("created_at", startedAt).eq("kind", "this_or_that");
    await admin.from("suggestions").delete().gte("created_at", startedAt);
    const { data: shots } = await admin.from("feedback").select("screenshot_path").eq("user_id", b.id);
    const paths = (shots ?? []).map((s) => s.screenshot_path as string | null).filter((p): p is string => !!p);
    if (paths.length) await admin.storage.from("feedback").remove(paths);
    await ctxA.close();
    await ctxB.close();
    await cleanup([a.id, b.id]);
  }
});
