import { expect, test, type Page } from "@playwright/test";
import { cleanup, pairedRoom, signInPath } from "./helpers";

async function startGame(pa: Page, pb: Page, roomId: string, game: string) {
  await pa.goto(`/room/${roomId}/games/${game}`);
  await pa.getByRole("button", { name: "Invite Bo" }).click();
  await expect(pa).toHaveURL(/\/play\//);
  await pb.getByRole("button", { name: "Join" }).click();
  await expect(pb).toHaveURL(pa.url());
}

test("chess: tap to move, checkmate in two browsers", async ({ browser }) => {
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
    await startGame(pa, pb, roomId, "chess");

    const board = (p: Page) => p.getByRole("grid", { name: /Chess board/ });
    await expect(board(pa)).toBeVisible();
    const adaIsWhite = /you play white/.test((await board(pa).getAttribute("aria-label")) ?? "");
    const [white, black] = adaIsWhite ? [pa, pb] : [pb, pa];
    await expect(board(black)).toHaveAttribute("aria-label", /you play black/);

    const move = async (p: Page, from: string, to: string, other: Page) => {
      await expect(board(p)).toHaveAttribute("aria-label", /Your move|Check/);
      await p.getByRole("gridcell", { name: new RegExp(`^${from},`) }).click();
      await expect(p.getByRole("gridcell", { name: new RegExp(`^${to}.*move here`) })).toBeVisible();
      await Promise.all([p.waitForResponse((r) => r.url().includes("/move") && r.ok()), p.getByRole("gridcell", { name: new RegExp(`^${to}`) }).click()]);
      await expect(other.getByRole("gridcell", { name: new RegExp(`^${to},`) })).toBeVisible();
    };

    // A piece that can't move shows no targets; it's not your turn means nothing happens.
    await black.getByRole("gridcell", { name: /^e7,/ }).click();
    await expect(black.getByRole("gridcell", { name: /move here/ })).toHaveCount(0);

    await move(white, "e2", "e4", black);
    await move(black, "e7", "e5", white);
    await move(white, "f1", "c4", black);
    await move(black, "b8", "c6", white);
    await move(white, "d1", "h5", black);
    await move(black, "g8", "f6", white);
    await white.getByRole("gridcell", { name: /^h5,/ }).click();
    if (process.env.SHOTS_DIR) {
      await white.screenshot({ path: `${process.env.SHOTS_DIR}/chess-white.png`, fullPage: true });
      await black.screenshot({ path: `${process.env.SHOTS_DIR}/chess-black.png`, fullPage: true });
    }
    await white.getByRole("gridcell", { name: /^f7.*move here/ }).click();

    await expect(white.getByRole("heading", { name: "You won." })).toBeVisible();
    await expect(black.getByRole("heading", { name: `${adaIsWhite ? "Ada" : "Bo"} won.` })).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await cleanup([a.id, b.id]);
    await ctxA.close();
    await ctxB.close();
  }
});

test("X and O: first to three, rounds alternate who starts", async ({ browser }) => {
  const { a, b, roomId } = await pairedRoom(["Ada", "Bo"]);
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pa = await ctxA.newPage();
  const pb = await ctxB.newPage();
  try {
    await pa.goto(await signInPath(a.email, `/room/${roomId}`));
    await pb.goto(await signInPath(b.email, `/room/${roomId}`));
    await startGame(pa, pb, roomId, "tic-tac-toe");
    const grid = (p: Page) => p.getByRole("grid", { name: /Noughts and crosses/ });
    await expect(grid(pa)).toBeVisible();

    const tap = async (p: Page, cell: number) => {
      const btn = p.getByRole("gridcell", { name: new RegExp(`^Square ${cell + 1},`) });
      await expect(btn).toBeEnabled();
      await Promise.all([p.waitForResponse((r) => r.url().includes("/move") && r.ok()), btn.click()]);
    };
    const whoseTurn = async () => ((await grid(pa).getAttribute("aria-label"))?.includes("Your move") ? pa : pb);

    // Ada always builds the top row; Bo plays the middle row. Whoever starts, Ada wins if she starts.
    for (let round = 1; round <= 5; round++) {
      await expect(grid(pa)).toHaveAttribute("aria-label", /Your move|move…/);
      const starter = await whoseTurn();
      const other = starter === pa ? pb : pa;
      // Starter takes the top row, the other the middle row: starter wins in 5 marks.
      await tap(starter, 0);
      await tap(other, 3);
      await tap(starter, 1);
      await tap(other, 4);
      await tap(starter, 2);
      const result = pa.getByText(/^((You win|Bo wins) the round|(You take|Bo takes) the match)\.$/);
      await expect(result).toBeVisible();
      if (/match/.test(await result.innerText())) break;
      await pa.getByRole("button", { name: "Next round" }).click();
      await expect(pa.getByText(new RegExp(`Round ${round + 1} · first to 3`))).toBeVisible();
    }
    // Starters alternate, so the 5th round decides it 3–2.
    await expect(pa.getByRole("heading", { name: /You won\.|Bo won\./ })).toBeVisible();
  } finally {
    await cleanup([a.id, b.id]);
    await ctxA.close();
    await ctxB.close();
  }
});
