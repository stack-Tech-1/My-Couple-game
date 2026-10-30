import { tourFor, type TourStep } from "@/games/tours";
import { soloGame } from "./catalog";

/**
 * "How to play" tours for Solo games: shown the first time you open one, skippable, and
 * replayable from the game. Steps with a `target` ring the element marked data-tour="<target>".
 */
export const SOLO_TOURS: Record<string, TourStep[]> = {
  "blend-am": [
    { target: "blend-tray", title: "Your pieces", body: ["You get three pieces at a time.", "Drag one onto the board, or tap it and then tap where it goes."] },
    { target: "blend-board", title: "Clear lines", body: ["Fill a whole row or column and it clears.", "Clear more than one at once, or a few turns running, for bonus points."] },
    { title: "Game over", body: ["When none of your pieces fit anywhere, the game ends.", "Leave room for the big ones."] },
  ],
  ajo: [
    { target: "ajo-board", title: "Slide the notes", body: ["Swipe (or use the arrow keys) and every note slides that way.", "A new ₦5 or ₦10 lands after each move."] },
    { title: "Two make one", body: ["Two of the same note join into the next one up: ₦5 and ₦5 make ₦10, and so on.", "Reach ₦1,000, then keep saving."] },
    { title: "Game over", body: ["When the board is full and nothing can join, the game ends.", "Keep your biggest notes in a corner."] },
  ],
  "okada-rush": [
    { target: "okada-road", title: "Ride", body: ["Your okada keeps moving. Swipe, use the arrows, or tap the buttons to turn."] },
    { title: "Pick up passengers", body: ["Ride over the red dots to pick people up. Every passenger makes your line longer."] },
    { target: "okada-keys", title: "Watch the road", body: ["Don't hit the edge, your own passengers, or the danfos and kekes.", "It gets faster the more you carry."] },
  ],
  reflex: [
    { target: "reflex-pad", title: "Wait for gold", body: ["Tap to start a round. The circle goes dark red.", "When it turns gold, tap as fast as you can."] },
    { title: "No jumping", body: ["Tap before it turns gold and that round starts again."] },
    { target: "reflex-times", title: "Your score", body: ["Five rounds. Your score is your average time.", "Lower is better."] },
  ],
  "fix-am": [
    { target: "fixam-board", title: "Slide the tiles", body: ["The picture is cut up and mixed. One square is empty.", "Tap a tile next to the gap to slide it in."] },
    { target: "fixam-peek", title: "Hold to peek", body: ["Forgot what it looks like? Hold this to see the whole picture."] },
    { title: "Quick and tidy", body: ["Put every tile back where it belongs. Fewer moves and less time mean more points.", "Finish a picture and it joins your collection."] },
  ],
  oro: [
    { target: "oro-board", title: "One word a day", body: ["Everyone gets the same five-letter word today. You have six guesses.", "On Fridays it's a Naija word, with a hint."] },
    { target: "oro-keys", title: "Make a guess", body: ["Type a real word, then Enter."] },
    { title: "Read the colours", body: ["Blue: right letter, right place.", "Gold: in the word, but somewhere else.", "Grey: not in the word.", "Finish it on the same day as your person and it counts towards your streak and level."] },
  ],
};

/** A Solo game's tour. Bot games borrow the real game's tour, with the bot in your partner's seat. */
export function soloTourFor(gameId: string): TourStep[] | undefined {
  const own = SOLO_TOURS[gameId];
  if (own) return own;
  const game = soloGame(gameId);
  if (game?.kind !== "bot" || !game.base) return undefined;
  const steps = tourFor(game.base);
  if (!steps) return undefined;
  const swap = (s: string) =>
    s
      .replace(/your partner's/g, "the bot's")
      .replace(/Your partner's/g, "The bot's")
      .replace(/your partner/g, "the bot")
      .replace(/Your partner/g, "The bot");
  return steps.map((s) => ({ ...s, body: s.body.map(swap) }));
}
