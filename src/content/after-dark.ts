/**
 * After Dark decks. Original, written for Amah. Warm is romantic, Hot suggestive; Fire can be explicit
 * (only shown when both partners chose Fire).
 * Heat: 1 Warm, 2 Hot, 3 Fire. Players can add their own cards (private to their room).
 * Every card can be skipped instantly, with no penalty and no explanation.
 */
export type Heat = 1 | 2 | 3;
export const HEAT_LABEL: Record<Heat, string> = { 1: "Warm", 2: "Hot", 3: "Fire" };
export type Card = { text: string; heat: Heat };

const deck = (heat: Heat, lines: string[]): Card[] => lines.map((text) => ({ text, heat }));

export const TRUTHS: Card[] = [
  ...deck(1, [
    "What was the exact moment you first thought I was attractive?",
    "What's something I wear that you secretly love?",
    "Which of my habits do you find unexpectedly cute?",
    "What's the most romantic thing you've ever daydreamed about us doing?",
    "When did you last catch yourself staring at me?",
    "What's a compliment you've wanted to give me but felt shy about?",
    "Which part of a date with me do you look forward to most?",
    "What's the best kiss we've ever had, and why?",
    "What song makes you think of me in a not-entirely-innocent way?",
    "If you could relive one evening we've spent together, which one?",
    "What's something small I do that gives you butterflies?",
    "Where's the most unexpected place you've wanted to kiss me?",
  ]),
  ...deck(2, [
    "What's a little fantasy you've never mentioned out loud?",
    "What's the most attractive thing I can do without even trying?",
    "When was the last time I really got your attention, and how?",
    "What's something you'd like me to whisper to you?",
    "Describe your perfect lazy morning in bed with me.",
    "What's one thing you'd love me to take the lead on more often?",
    "Which outfit of mine would you most like to take off?",
    "What's the most tempting text I could send you right now?",
    "What do you find most irresistible about the way I kiss?",
    "What's a place you'd love to be alone with me, somewhere we've never been?",
    "What's something about tonight you're hoping for?",
    "Where's your favourite place to be touched that isn't obvious?",
  ]),
  ...deck(3, [
    "What's the boldest thing you'd want to try together, if we said yes to everything?",
    "Tell me, in detail, how you'd like tonight to end.",
    "What's a memory of us you replay when you're alone?",
    "What's one thing you've always wanted me to ask you to do?",
    "What's the most daring place you'd like to sneak away with me?",
    "Describe the most irresistible version of me.",
    "What's something you'd love me to say to you, word for word?",
    "What would you do if we had the whole house to ourselves all weekend?",
    "What's a secret wish you've been saving for the right moment?",
    "What's the one thing I could do in the next ten minutes that would drive you wild?",
  ]),
];

export const DARES: Card[] = [
  ...deck(1, [
    "Give your partner a slow, thirty-second shoulder massage.",
    "Whisper three things you like about your partner, one in each ear.",
    "Hold eye contact for a full minute without laughing.",
    "Kiss your partner somewhere other than their lips. They choose where.",
    "Slow dance to the next song that comes on, however silly it is.",
    "Draw a heart on your partner's hand with your fingertip.",
    "Send your partner a flirty text, even though you're right here.",
    "Recreate your first kiss, as best you remember it.",
    "Give your partner your best pick-up line, with total commitment.",
    "Sit as close as you can for the next two turns.",
    "Feed your partner something sweet, slowly.",
    "Give a ten-second forehead kiss.",
  ]),
  ...deck(2, [
    "Kiss your partner's neck. Take your time.",
    "Blindfold your partner and kiss them three times. They guess where each one was.",
    "Run your fingers through your partner's hair for a whole minute.",
    "Whisper what you'd like to do later. Keep it a tease.",
    "Trade one item of clothing with your partner for the rest of the game.",
    "Give your partner a hand massage like it's a five-star spa.",
    "Sit in your partner's lap for the next round.",
    "Kiss your partner like it's the last scene of a romance film.",
    "Trace a word on your partner's back. They have to guess it.",
    "Let your partner choose where you kiss them next.",
    "Turn the lights down and describe your partner using only compliments.",
    "Nibble your partner's ear. Gently.",
  ]),
  ...deck(3, [
    "Let your partner give you instructions for the next two minutes. You can say no to anything.",
    "Take off one item of clothing, as slowly as you dare.",
    "Kiss your partner, starting at their wrist and working your way up.",
    "Close your eyes. Your partner does whatever they like for thirty seconds (within your limits).",
    "Describe exactly what you'd do if this game ended right now.",
    "Give your partner a massage, anywhere they ask.",
    "Pick a spot. Kiss it for a slow count of ten.",
    "Whisper your boldest idea for later. No follow-up questions until then.",
    "Swap places: your partner chooses your next dare.",
    "Leave a trail of kisses wherever your partner points.",
  ]),
];

/** Spicy Dice: one die says what, the other says where or how. Six faces each, per heat. */
export const DICE: Record<Heat, { action: string[]; where: string[] }> = {
  1: {
    action: ["Kiss", "Whisper to", "Massage", "Hold", "Compliment", "Tickle"],
    where: ["your hand", "the cheek", "the shoulder", "the forehead", "for ten seconds", "with your eyes closed"],
  },
  2: {
    action: ["Kiss", "Nibble", "Massage", "Breathe on", "Trace", "Caress"],
    where: ["the neck", "the ear", "the lower back", "the collarbone", "slowly", "while whispering"],
  },
  3: {
    action: ["Kiss", "Lick", "Undress", "Tease", "Massage", "Your choice:"],
    where: ["wherever they point", "somewhere new", "very slowly", "for thirty seconds", "blindfolded", "their choice"],
  },
};

export const HOT_SEAT: Card[] = [
  ...deck(1, [
    "Where's your favourite place to be kissed?",
    "What's my most attractive feature?",
    "What did you think the first time you saw me?",
    "What's the flirtiest thing I've ever said to you?",
    "What's your idea of the perfect date night in?",
    "Which of my outfits is your favourite?",
    "What's one thing that always puts you in the mood for romance?",
    "Who made the first move: really?",
    "What's your favourite way to wake up next to me?",
    "What's the sweetest thing I could do for you tomorrow?",
  ]),
  ...deck(2, [
    "What's a fantasy you'd be willing to tell me the first line of?",
    "What's your favourite way to be touched?",
    "When do you find me hardest to resist?",
    "What would you like more of from me, after dark?",
    "What's the most memorable night we've had?",
    "Rate my kissing out of ten. Then explain yourself.",
    "What would you do with a whole day of me saying yes?",
    "What's something new you'd like to try with me?",
    "Which room in the house has the most potential?",
    "What's your biggest turn-on that has nothing to do with looks?",
  ]),
  ...deck(3, [
    "What's the wildest thing you'd want to do with me, given total privacy?",
    "Describe your ideal night, start to finish.",
    "What's one boundary you'd like to explore together, slowly?",
    "What's the most tempting thing I could say to you right now?",
    "What do you think about when you think about me, alone?",
    "If tonight had no rules, what would you ask me for?",
    "What's something you've always been curious about but never said?",
    "What's the best thing I've ever done to you?",
  ]),
];

export const NEVER: Card[] = [
  ...deck(1, [
    "Never have I ever daydreamed about you during a meeting.",
    "Never have I ever practised a kiss on my hand.",
    "Never have I ever sent a flirty text to the wrong person.",
    "Never have I ever had a crush on a teacher.",
    "Never have I ever kissed someone in the rain.",
    "Never have I ever dressed up specifically to impress you.",
    "Never have I ever reread our old messages.",
    "Never have I ever planned an outfit around a date.",
    "Never have I ever faked being asleep to get a cuddle.",
    "Never have I ever kissed on a first date.",
    "Never have I ever had a dream about you I didn't tell you about.",
    "Never have I ever been jealous for absolutely no reason.",
  ]),
  ...deck(2, [
    "Never have I ever skinny-dipped.",
    "Never have I ever kissed somewhere we could have been caught.",
    "Never have I ever sent a photo I'd be embarrassed to have printed.",
    "Never have I ever had a fantasy about a colleague.",
    "Never have I ever had a holiday romance.",
    "Never have I ever been told I'm a good kisser.",
    "Never have I ever worn something just to drive you a little crazy.",
    "Never have I ever made the first move.",
    "Never have I ever woken up thinking about last night.",
    "Never have I ever left a party early for a better offer.",
    "Never have I ever kissed in a lift.",
    "Never have I ever planned a seduction.",
  ]),
  ...deck(3, [
    "Never have I ever done something in public I'd blush to describe.",
    "Never have I ever had a fantasy I'd be too shy to say out loud.",
    "Never have I ever stayed up all night for the best reasons.",
    "Never have I ever surprised someone wearing very little.",
    "Never have I ever tried something I'd read about.",
    "Never have I ever been caught in the act.",
    "Never have I ever been the one doing the teasing all evening.",
    "Never have I ever wanted to try something we haven't yet.",
  ]),
];

/** Fantasy Match: each person privately marks Yes / Maybe / No. Only mutual yeses are ever shown. */
export type FantasyItem = { id: string; text: string; group: string };
export const FANTASY_GROUPS = ["Romantic", "Playful", "Adventurous", "Bold"] as const;
export const FANTASY: FantasyItem[] = [
  { id: "candle-dinner", group: "Romantic", text: "A candlelit dinner that ends in the bedroom" },
  { id: "slow-dance", group: "Romantic", text: "Slow dancing with nothing to do after" },
  { id: "love-letter", group: "Romantic", text: "Reading each other a love letter out loud" },
  { id: "weekend-away", group: "Romantic", text: "A whole weekend away, phones off" },
  { id: "bath", group: "Romantic", text: "A long bath together" },
  { id: "breakfast-bed", group: "Romantic", text: "Breakfast in bed that turns into brunch in bed" },
  { id: "massage", group: "Romantic", text: "A full, slow massage with oils" },
  { id: "stargazing", group: "Romantic", text: "Kissing under the stars somewhere remote" },
  { id: "strip-game", group: "Playful", text: "A strip version of a board game" },
  { id: "role-meet", group: "Playful", text: "Meeting at a bar and pretending to be strangers" },
  { id: "dress-up", group: "Playful", text: "Dressing up for each other" },
  { id: "dirty-talk", group: "Playful", text: "Teasing each other with words all evening" },
  { id: "notes-day", group: "Playful", text: "A day of secret, flirty notes left around the house" },
  { id: "photo-shoot", group: "Playful", text: "A private, playful photo shoot (photos stay ours)" },
  { id: "dance-show", group: "Playful", text: "A private dance, just for you" },
  { id: "dice-night", group: "Playful", text: "A whole night where the dice decide" },
  { id: "blindfold", group: "Adventurous", text: "A blindfold" },
  { id: "new-room", group: "Adventurous", text: "Somewhere in the house we've never tried" },
  { id: "hotel", group: "Adventurous", text: "A spontaneous hotel night in our own city" },
  { id: "outdoors", group: "Adventurous", text: "Somewhere outdoors (and private)" },
  { id: "shower", group: "Adventurous", text: "A shower together" },
  { id: "morning", group: "Adventurous", text: "Waking you up in the best way" },
  { id: "instructions", group: "Adventurous", text: "One of us gives the instructions all night" },
  { id: "toys", group: "Adventurous", text: "Shopping for something new together" },
  { id: "mirror", group: "Bold", text: "In front of a mirror" },
  { id: "lingerie", group: "Bold", text: "Choosing an outfit for each other to wear" },
  { id: "tie-up", group: "Bold", text: "Gentle restraints (silk ties, safe word agreed)" },
  { id: "lights-on", group: "Bold", text: "Lights fully on" },
  { id: "video-call", group: "Bold", text: "A very flirty video call when we're apart" },
  { id: "roleplay", group: "Bold", text: "A roleplay scenario we write together" },
  { id: "tease-all-day", group: "Bold", text: "An all-day tease that pays off at night" },
  { id: "new-position", group: "Bold", text: "Trying something brand new from a book" },
];
