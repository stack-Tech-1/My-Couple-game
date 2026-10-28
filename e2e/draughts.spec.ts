import { expect, test, type Page } from "@playwright/test";
import { cleanup, pairedRoom, signInPath } from "./helpers";

test("draughts: forced capture and recapture in two browsers, then a draw", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  const errors: string[] = [];
  for (const p of [pa, pb]) p.on("pageerror", (e) => errors.push(e.message));
  try {
    await pa.goto(await signInPath(a.email, `/room/${roomId}`));
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));
    await pa.goto(`/room/${roomId}/games/draughts`);
    await pa.getByRole("button", { name: "Invite Bo" }).click();
    await expect(pa).toHaveURL(/\/play\//);
    await pb.getByRole("button", { name: "Join" }).click();
    await expect(pb).toHaveURL(pa.url());

    const board = (p: Page) => p.getByRole("grid", { name: /Draughts board/ });
    await expect(board(pa)).toBeVisible();
    const adaIsWhite = /you play white/.test((await board(pa).getAttribute("aria-label")) ?? "");
    const [white, black] = adaIsWhite ? [pa, pb] : [pb, pa];
    const cell = (p: Page, n: number) => p.getByRole("gridcell", { name: new RegExp(`^Square ${n}(,|$)`) });

    const move = async (p: Page, other: Page, ...path: number[]) => {
      await expect(board(p)).toHaveAttribute("aria-label", /Your move|must capture/);
      await cell(p, path[0]!).click();
      for (const n of path.slice(1, -1)) await cell(p, n).click();
      const to = path[path.length - 1]!;
      await expect(p.getByRole("gridcell", { name: new RegExp(`^Square ${to}, move here`) })).toBeVisible();
      await Promise.all([p.waitForResponse((r) => r.url().includes("/move") && r.ok()), cell(p, to).click()]);
      await expect(other.getByRole("gridcell", { name: new RegExp(`^Square ${to}, `) })).toBeVisible();
    };

    await move(white, black, 32, 28);
    await move(black, white, 19, 23);
    // White must take: other pieces offer nothing.
    await expect(board(white)).toHaveAttribute("aria-label", /You must capture/);
    await cell(white, 31).click();
    await expect(white.getByRole("gridcell", { name: /move here/ })).toHaveCount(0);
    await move(white, black, 28, 19);
    await expect(cell(black, 23)).toHaveAttribute("aria-label", "Square 23");
    // Black recaptures.
    await expect(board(black)).toHaveAttribute("aria-label", /You must capture/);
    await move(black, white, 14, 23);
    await expect(white.getByText("19 pieces")).toHaveCount(2);
    if (process.env.SHOTS_DIR) {
      await white.screenshot({ path: `${process.env.SHOTS_DIR}/draughts-white.png`, fullPage: true });
      await black.screenshot({ path: `${process.env.SHOTS_DIR}/draughts-black.png`, fullPage: true });
    }

    await white.getByRole("button", { name: "Offer a draw" }).click();
    await black.getByRole("button", { name: "Accept" }).click();
    await expect(white.getByRole("heading", { name: "Dead even." })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await cleanup([a.id, b.id]);
    await ctxA.close();
    await ctxB.close();
  }
});
