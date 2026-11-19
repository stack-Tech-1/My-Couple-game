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
    { target: "okada-road", title: "Ride", body: ["Your okada keeps moving up the road. Swipe left or right (or tap that side) to change lane."] },
    { title: "Carry passengers", body: ["Someone waving at the kerb? Ride past them in the lane beside that kerb to pick them up.", "Then drop them at their bus stop, in the lane beside it, for the fare."] },
    { target: "okada-keys", title: "Watch the road", body: ["A stopped danfo, a barrier or a deep pothole ends the ride. Small potholes slow you and cost the tip.", "Agberos and LASTMA wait at the kerb. It gets faster as you go."] },
  ],
  "pump-am": [
    { target: "pump-buttons", title: "Pump the water", body: ["Each button sends a burst of water up on its side.", "The left pump steers rings towards the left peg, the right pump towards the right peg."] },
    { target: "pump-tank", title: "Land them flat", body: ["A ring that sinks down flat over a peg slides on and stays.", "Rings standing on their edge just bounce off. Wait for them to lie down."] },
    { title: "Patience pays", body: ["Hang all ten before the three minutes are up for a time bonus.", "Hammering the buttons keeps everything floating. Little presses work better."] },
  ],
  "bash-am": [
    { target: "bash-wall", title: "Break the wall", body: ["Tap to launch the ball. Every brick it hits breaks.", "Dark bricks are tough: they take two hits."] },
    { target: "bash-plank", title: "Keep it up", body: ["Drag anywhere to move your plank. Where the ball lands on it decides the angle.", "Drop it and you lose a ball. Three balls, then it's over."] },
    { title: "Capsules and combos", body: ["Gold capsules fall from some bricks: GEN widens your plank, SLOW calms the ball, +1 is an extra ball.", "Break bricks one after another without touching the plank for a bigger combo."] },
  ],
  "zobo-sort": [
    { target: "zobo-shelf", title: "Pour and sort", body: ["Tap a bottle to pick it up, then tap another to pour into it.", "You can pour onto the same drink, or into an empty bottle."] },
    { title: "One drink a bottle", body: ["Finish when every bottle holds just one drink.", "Use few pours for three stars. Each stall adds a new twist."] },
    { target: "zobo-undo", title: "Made a mess?", body: ["Undo takes back a pour (five a level), and it counts as a pour. Restart begins the level again.", "Stuck? Spend your takings on a hint or an extra bottle."] },
  ],
  "catch-am": [
    { target: "catch-market", title: "Catch the food", body: ["Puff-puff and akara fall from the stalls. Drag your basket under them."] },
    { title: "Dodge the pepper", body: ["A pepper in your basket costs a life. Three peppers and you're out.", "Dropping food doesn't cost a life, but it breaks your combo."] },
    { target: "catch-basket", title: "Combos", body: ["Three good catches in a row and your points start multiplying.", "Golden puff-puff is worth triple. It gets faster as you go."] },
  ],
  "mosquito-wahala": [
    { target: "mosquito-room", title: "Protect your sleep", body: ["Mosquitoes zig-zag down towards your bed. Each one that gets there bites you.", "Five bites and the night is over."] },
    { target: "mosquito-can", title: "Spray am", body: ["Drag the can under them. It sprays by itself.", "Big ones take three puffs."] },
    { title: "Power-ups", body: ["Some mosquitoes drop help: a coil slows them, a net stops bites for a while, and double spray does what it says.", "On career nights, kills fill your Big Spray. Tap it when it's full to clear the room."] },
  ],
  "mama-put": [
    { target: "mama-shop", title: "Lunch rush", body: ["Customers come to the counter. Their bubble shows what they want; the ring is their patience.", "You have 90 seconds. Make as much money as you can."] },
    { target: "mama-plates", title: "Dish and serve", body: ["Tap a plate on the counter, then tap the food to dish it: rice, stew, meat, and so on.", "When it matches the order, tap Serve. The quicker you are, the bigger the tip."] },
    { title: "Mind the dodo", body: ["Dodo has to be fried first: tap the pan, wait, then tap it again to dish.", "Leave it too long and it burns.", "Wrong plate? They leave without paying. Bin it and start again."] },
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
