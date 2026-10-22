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
export const TIMED_TOURS = new Set(["reflex-duel", "draw-guess", "this-or-that", "compliment-battle"]);

/** The four quiz games share a board, so they share a tour after their own first line. */
const quiz = (what: string): TourStep[] => [
  { target: "quiz-options", title: "Pick an answer", body: [what, "Tap one of the four answers. You can't change it after."] },
  { target: "quiz-progress", title: "No copying", body: ["Everyone gets the same question. The right answer only shows once you've all picked."] },
  { title: "Winning", body: ["A point for every right answer. Most points at the end wins."] },
];

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
  riddles: quiz("Read the riddle. The answer is usually simpler (or cheekier) than you think."),
  "naija-trivia": quiz("Questions about Naija: places, festivals, books and history."),
  "pidgin-palava": quiz("A Pidgin word or phrase. Pick what it really means."),
  "emoji-guess": quiz("The emoji tell the title of an Afrobeats hit or a Nollywood favourite."),
  "know-me-trivia": [
    { title: "Write about you", body: ["First, write a few questions about yourself, or borrow some from our bank.", "Add the real answer and three convincing fakes."] },
    { title: "Answer theirs", body: ["Then answer the questions your partner wrote about them. You both answer at the same time."] },
    { title: "Scoring", body: ["100 points for each right answer, plus a bonus for getting them in a row.", "Whoever knows the other better wins."] },
  ],
  "how-well": [
    { title: "Two taps per question", body: ["First, your own honest answer.", "Then your guess for what your partner said."] },
    { title: "The reveal", body: ["Nothing shows until you've both finished. Then it's side by side, with a point for every right guess."] },
  ],
  "this-or-that": [
    { title: "Pick fast", body: ["Twelve cards, two choices each. Tap the side you'd pick.", "You get ten seconds a card. Out of time? It's skipped."] },
    { title: "The reveal", body: ["When you've both finished, see every pick side by side, and how in tune you are."] },
  ],
  "story-chain": [
    { title: "One line each", body: ["We start you off with an opening line. Then you take turns adding one sentence."] },
    { title: "The end", body: ["After a few lines, either of you can write “The End” and give it a title.", "Save the finished story as a card to keep or share."] },
  ],
  "deep-questions": [
    { title: "One card at a time", body: ["Take turns answering, out loud and face to face if you can.", "Skip any card. No explanation needed."] },
    { title: "Go deeper when ready", body: ["The questions start light. Move to the next level when you're both ready. There's no score."] },
  ],
  "compliment-battle": [
    { title: "Write", body: ["Forty-five seconds a round. Write up to five compliments for your partner.", "Specific beats generic."] },
    { title: "Judge", body: ["Then read theirs and give each one up to three hearts. Neither of you sees the hearts until you've both judged."] },
    { title: "Winning", body: ["Three rounds. Most hearts takes the crown. Honestly, you both win."] },
  ],
  "love-styles": [
    { title: "Go with your gut", body: ["Ten either-or choices. Pick the one that would mean more to you."] },
    { title: "Guess theirs", body: ["Then guess which style your partner will land on.", "At the end you'll see both styles side by side, and whether your guess was right."] },
  ],
  "same-page": [
    { title: "Answer honestly", body: ["Ten real-life questions: money, family, children, where to live.", "You won't see each other's answers until you've both finished."] },
    { title: "Talk about it", body: ["Matches are counted, and the differences are marked as worth a conversation. There are no wrong answers."] },
  ],
  "dont-laugh": [
    { title: "Perform", body: ["On your turn, only you see the prompt. Act it out with your whole chest.", "Don't like it? Swap it once per turn."] },
    { title: "Watch, straight-faced", body: ["On their turn, don't laugh. When they finish, be honest: did you? A cracked smile counts."] },
    { title: "Scoring", body: ["Every laugh is a point for the performer. Most points wins."] },
  ],
  "most-likely": [
    { title: "Vote", body: ["“Who's most likely to…?” Tap the person who fits best. Yourself counts, if you're honest."] },
    { title: "Anonymous", body: ["The count shows once everyone has voted. Nobody ever sees who voted for whom."] },
  ],
  "truth-or-dare": [
    { title: "Your turn", body: ["Pick truth or dare. Answer honestly, or do the dare. Then it's their turn."] },
    { title: "Skip anything", body: ["Either of you can skip any card, instantly. No penalty, no questions."] },
    { title: "Heat", body: ["Warm, Hot or Fire. It never goes past the lower of your two limits, and either of you can turn it down."] },
  ],
  "hot-seat": [
    { title: "In the seat", body: ["One of you takes the hot seat for a run of flirty questions, then you swap.", "Answer out loud. Theatrics encouraged."] },
    { title: "Skip anything", body: ["Either of you can skip a question. No explanation needed."] },
  ],
  "never-have-i": [
    { title: "Secret answers", body: ["A statement appears. You each tap “I have” or “I haven't” in secret.", "Then you both find out."] },
    { title: "Skip anything", body: ["Either of you can skip a card. No one sees why."] },
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
