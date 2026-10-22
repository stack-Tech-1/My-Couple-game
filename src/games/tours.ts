/**
 * "How to play" tours: shown the first time someone opens a game, skippable, replayable from the
 * board. A step with a `target` spotlights the element marked data-tour="<target>" on the board;
 * a step without one is a plain card. Bodies are short lines, one idea each.
 */
export type TourStep = { target?: string; title: string; body: string[] };

/**
 * Games with a clock that runs from the start. Their tour is shown before the board opens (when you
 * start or join), so reading it never costs anyone time. Their steps have no targets.
 */
export const TIMED_TOURS = new Set(["reflex-duel", "draw-guess"]);

export const GAME_TOURS: Record<string, TourStep[]> = {
  "word-duel": [
    { target: "wd-board", title: "Your board", body: ["There's one secret five-letter word, the same for everyone.", "You get six guesses to find it."] },
    { target: "wd-keys", title: "Make a guess", body: ["Tap the letters, then Enter.", "It has to be a real word."] },
    { title: "Read the colours", body: ["Green: right letter, right spot.", "Gold: the letter is in the word, but somewhere else.", "Grey: not in the word at all.", "The keyboard colours up too, so you can see what's left."] },
    { target: "wd-others", title: "The race", body: ["Here you see how the others are doing: their colours, never their letters.", "First to crack the word wins."] },
  ],
  whot: [
    { target: "whot-hand", title: "Your hand", body: ["These are your cards. Swipe to see them all.", "Tap a card to play it."] },
    { target: "whot-table", title: "Match the top card", body: ["Your card must match the card on top by shape or by number.", "Circle on circle, or 7 on 7."] },
    { target: "whot-market", title: "Go to market", body: ["No card that matches? Tap the market to draw one.", "That ends your turn."] },
    {
      title: "Special cards",
      body: ["1, Hold On: you play again.", "2, Pick Two and 5, Pick Three: the next player draws.", "8, Suspension: the next player misses a turn.", "14, General Market: everyone else draws one.", "20, Whot: plays on anything, and you choose the shape."],
    },
    { title: "Winning", body: ["First to empty their hand wins.", "If a “Call last card” button appears, tap it before you play, or you'll pick two."] },
  ],
  ludo: [
    { target: "ludo-board", title: "The board", body: ["Your colour starts in its corner. Get all four tokens around the board and into the middle.", "First with all four home wins."] },
    { target: "ludo-roll", title: "Roll", body: ["When it's your turn, tap Roll."] },
    { target: "ludo-dice", title: "Pick a die, then a token", body: ["With two dice, tap a die (or “Both” to add them up), then tap a glowing token to move it.", "Use one die on each token, or both on one."] },
    { title: "Getting out", body: ["A six brings a token out of your corner.", "Double six? Roll again."] },
    { title: "Capturing", body: ["Land on someone's token to send it back to their corner, and roll again.", "Stars and start squares are safe."] },
  ],
  ayo: [
    { target: "ayo-mine", title: "Your pits", body: ["The bottom row is yours. Your partner's is the top."] },
    { target: "ayo-board", title: "Sow", body: ["Tap one of your pits. Its seeds are dropped one by one, round the board, counter-clockwise."] },
    { title: "Capture", body: ["If your last seed lands on your partner's side and makes that pit 2 or 3, you take them.", "The pits just before it can be taken too, if they're also 2 or 3."] },
    { target: "ayo-score", title: "Winning", body: ["Captured seeds go in your store. First to 25 wins."] },
  ],
  "connect-four": [
    { target: "c4-board", title: "Drop a disc", body: ["Tap a column. Your disc falls to the lowest empty space."] },
    { target: "c4-players", title: "Take turns", body: ["You each have a colour. It's lit up when it's your go."] },
    { title: "Winning", body: ["Four of your discs in a line wins: across, up and down, or diagonally.", "Block theirs while you build yours."] },
  ],
  "memory-match": [
    { target: "mm-cards", title: "Flip two", body: ["On your turn, flip two cards. A pair stays face up.", "Then it's your partner's turn either way."] },
    { target: "mm-clock", title: "Beat the clock together", body: ["The clock starts on the first flip.", "Clear all eight pairs in time and you both win."] },
    { title: "Talk", body: ["Tell each other what you saw. That's the whole game."] },
  ],
  "split-clues": [
    { target: "sc-clues", title: "Your clues", body: ["Only you can see these. Your partner has different ones.", "Neither of you can solve it alone."] },
    { target: "sc-chat", title: "Share them", body: ["Read your clues out loud, or type them here."] },
    { target: "sc-answer", title: "Answer", body: ["Either of you can answer. A wrong answer costs a life, and you share six."] },
    { title: "Stuck?", body: ["Take a hint. It's free, but it costs a star."] },
  ],
  "beat-the-clock": [
    { title: "One team, one score", body: ["Sixty seconds. Quick sums, odd ones out, and colour words.", "Every right answer adds to the score you share."] },
    { title: "Colour words", body: ["When a colour's name is printed in another colour, tap the colour of the ink, not the word."] },
    { title: "Mistakes", body: ["A wrong answer takes two seconds off the clock for both of you."] },
    { target: "btc-ready", title: "Ready?", body: ["The clock starts when you both tap “I'm ready”."] },
  ],
  "in-sync": [
    { target: "is-words", title: "Say the same word", body: ["Round one: you each type any word, in secret. Then both are shown here."] },
    { target: "is-input", title: "Meet in the middle", body: ["Next round, think of one word that links the two you just said, and lock it in."] },
    { title: "Winning", body: ["Keep going until you both say the same word. Do it within ten rounds to win."] },
  ],
  "spicy-dice": [
    { target: "sd-dice", title: "Two dice", body: ["One die says what. The other says where, or how."] },
    { target: "sd-roll", title: "Roll and do it", body: ["Roll, do what the dice say, then pass the dice.", "Not feeling it? Re-roll. No questions."] },
    { target: "sd-heat", title: "Heat", body: ["Set how spicy the dice get. It never goes past what you both agreed to."] },
  ],
  "reflex-duel": [
    { title: "Wait for it", body: ["The screen stays dark for a few seconds.", "When it flashes, tap anywhere, as fast as you can."] },
    { title: "No jumping", body: ["Tap before the flash and you're out of that round."] },
    { title: "Winning", body: ["Fastest tap takes the round. First to four rounds wins.", "Your time is measured on your own phone, so a slow connection won't cost you."] },
  ],
  "draw-guess": [
    { title: "Take turns drawing", body: ["When it's your turn, pick one of three words and draw it.", "No letters or numbers."] },
    { title: "Guess", body: ["When someone else draws, type your guesses. As many as you like.", "We'll tell you when you're one letter off."] },
    { title: "Points", body: ["Guess faster, score more.", "The artist scores when someone gets it."] },
  ],
};

export const tourFor = (gameId: string): TourStep[] | undefined => GAME_TOURS[gameId];
