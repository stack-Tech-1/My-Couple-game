import { expect, test } from "@playwright/test";
import { admin, cleanup, pairedRoom, signInPath } from "./helpers";

const SHOTS = process.env.SHOTS_DIR;
const shot = async (page: import("@playwright/test").Page, name: string) => {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: true });
};

/** Love Notes, Memory Lane, Date Night and the Bucket List, in two real browsers. */
test("romantic features work end to end", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const ctxA = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const ctxB = await browser.newContext({ viewport: { width: 400, height: 860 } });
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));

  try {
    await pa.goto(await signInPath(a.email, `/room/${roomId}/games/love-notes`));
    await pb.goto(await signInPath(b.email, `/room/${roomId}/games/love-notes`));

    // --- Love notes: one sealed for next week, one to open now.
    await pa.getByRole("tab", { name: "Write one" }).click();
    await pa.getByLabel(/Dear Bo/).fill("Open this on our anniversary.");
    await pa.getByRole("radio", { name: /Wine/ }).click();
    await pa.getByRole("switch", { name: "Seal it until a date" }).click();
    const nextWeek = new Date(Date.now() + 7 * 86_400_000);
    const local = new Date(nextWeek.getTime() - nextWeek.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
    await pa.getByLabel("Opens on").fill(local);
    await shot(pa, "notes-compose");
    await pa.getByRole("button", { name: "Seal and send" }).click();
    await expect(pa.getByText("Sealed and delivered.")).toBeVisible();

    await pa.getByRole("tab", { name: "Write one" }).click();
    await pa.getByLabel(/Dear Bo/).fill("You make Tuesdays feel like Fridays.\n\nThat's all. That's the note.");
    await pa.getByRole("button", { name: "Send it" }).click();
    await expect(pa.getByText("Delivered.", { exact: true })).toBeVisible();

    // A toast announces each arrival; its Read button jumps to the inbox.
    await pb.getByRole("button", { name: "Read" }).first().click();
    await expect(pb.getByRole("button", { name: "Open your letter" })).toBeVisible();
    await expect(pb.getByText("Opens in 7 days", { exact: false })).toBeVisible();
    await shot(pb, "notes-inbox");
    await pb.getByRole("button", { name: "Open your letter" }).click();
    await expect(pb.getByText("You make Tuesdays feel like Fridays.", { exact: false })).toBeVisible();
    await pb.waitForTimeout(700);
    await shot(pb, "notes-envelope");
    await expect(pb.getByRole("button", { name: "Fold it back up" })).toBeVisible();
    await pb.waitForTimeout(600);
    await shot(pb, "notes-letter");
    await pb.getByRole("button", { name: "Fold it back up" }).click();
    expect(await pb.content()).not.toContain("anniversary");

    // --- Memory Lane: upload a generated photo, partner answers.
    await pa.goto(`/room/${roomId}/games/memory-lane`);
    const jpeg = await pa.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 1200;
      c.height = 900;
      const g = c.getContext("2d")!;
      const grad = g.createLinearGradient(0, 0, 1200, 900);
      grad.addColorStop(0, "#e8563a");
      grad.addColorStop(1, "#5b1a2b");
      g.fillStyle = grad;
      g.fillRect(0, 0, 1200, 900);
      g.fillStyle = "#f6efe6";
      g.beginPath();
      g.arc(820, 300, 120, 0, Math.PI * 2);
      g.fill();
      const blob: Blob = await new Promise((r) => c.toBlob((x) => r(x!), "image/jpeg", 0.9));
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });
    await pa.locator('input[type="file"]').setInputFiles({ name: "sunset.jpg", mimeType: "image/jpeg", buffer: Buffer.from(jpeg) });
    await pa.getByRole("button", { name: "Add to the timeline" }).click();
    await expect(pa.getByText("Added to Memory Lane.")).toBeVisible();

    await pb.goto(`/room/${roomId}/games/memory-lane`);
    await pb.getByLabel("Your answer").fill("Lisbon, the night the tram broke down");
    await pb.getByRole("button", { name: "Answer" }).click();
    await expect(pb.getByText("“Lisbon, the night the tram broke down”")).toBeVisible();
    await shot(pb, "memory-lane");
    const { data: mem } = await admin.from("memories").select("path").eq("room_id", roomId).single();
    expect(mem!.path.startsWith(`${roomId}/`)).toBe(true);
    // the photo is served only through a signed URL
    const src = await pb.locator("figure img").first().getAttribute("src");
    expect(src).toContain("token=");

    // --- Date night: Ada spins, Bo sees the same result.
    await pa.goto(`/room/${roomId}/games/date-night`);
    await pb.goto(`/room/${roomId}/games/date-night`);
    await pa.waitForLoadState("networkidle");
    await pb.waitForLoadState("networkidle");
    await pa.getByRole("button", { name: "Spin", exact: true }).click();
    await expect(pa.getByRole("button", { name: "Spin again" })).toBeVisible();
    const pickA = await pa.locator("h2").first().textContent();
    await expect(pb.locator("h2").first()).toHaveText(pickA!);
    await shot(pa, "date-night");
    await pa.getByRole("button", { name: "Save to bucket list" }).click();
    await expect(pa.getByText("Added to your bucket list.")).toBeVisible();

    // --- Bucket list: the saved idea is there; Bo ticks it off.
    await pb.goto(`/room/${roomId}/games/bucket-list`);
    await pb.getByRole("checkbox", { name: `Done: ${pickA}` }).click();
    await expect(pb.getByText("Done together")).toBeVisible();
    await shot(pb, "bucket-list");

    await pa.goto(`/room/${roomId}`);
    await expect(pa.getByText(`Ticked off the bucket list: ${pickA}.`)).toBeVisible();
    await shot(pa, "home-after");

    await admin.storage.from("memories").remove([mem!.path]);
    expect(errors).toEqual([]);
  } finally {
    await cleanup([a.id, b.id]);
    await ctxA.close();
    await ctxB.close();
  }
});