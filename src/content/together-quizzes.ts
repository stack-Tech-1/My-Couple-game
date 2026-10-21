/** Content for Love Styles, On the Same Page and Don't Laugh. All original, written for Amah. */

export const LOVE_STYLES = ["words", "time", "gifts", "help", "touch"] as const;
export type LoveStyle = (typeof LOVE_STYLES)[number];

export const LOVE_STYLE_INFO: Record<LoveStyle, { label: string; tip: string }> = {
  words: { label: "Kind words", tip: "Say it out loud: what you love, what you're proud of, what they got right today." },
  time: { label: "Time together", tip: "Phones down, full attention. Even twenty minutes of proper gist counts." },
  gifts: { label: "Thoughtful gifts", tip: "Small and specific beats big and random. Their favourite snack, picked up on the way home." },
  help: { label: "Helping hands", tip: "Take one thing off their plate before they ask: the dishes, the errand, the call they're dreading." },
  touch: { label: "Touch", tip: "Hold hands, long hugs, a back rub after a long day. Closeness says it for you." },
};

/** Ten either-or choices, one for every pair of styles, so each style comes up four times. */
export const LOVE_STYLE_PAIRS: [{ text: string; style: LoveStyle }, { text: string; style: LoveStyle }][] = [
  [{ text: "Hearing you say \"I'm proud of you\"", style: "words" }, { text: "An evening together with our phones away", style: "time" }],
  [{ text: "A long, sweet message out of nowhere", style: "words" }, { text: "A small surprise you picked up because it made you think of me", style: "gifts" }],
  [{ text: "You telling me what you love about me", style: "words" }, { text: "You handling something I've been dreading", style: "help" }],
  [{ text: "Something sweet whispered in my ear", style: "words" }, { text: "A long hug when I walk in", style: "touch" }],
  [{ text: "A whole day planned just around us", style: "time" }, { text: "A gift you clearly put real thought into", style: "gifts" }],
  [{ text: "Gisting with you for hours", style: "time" }, { text: "Coming home to find the chores already done", style: "help" }],
  [{ text: "A walk together, just talking", style: "time" }, { text: "Cuddling on the couch, no talking needed", style: "touch" }],
  [{ text: "My favourite snack waiting for me", style: "gifts" }, { text: "You fixing the thing that's been broken for weeks", style: "help" }],
  [{ text: "Something you brought back for me from a trip", style: "gifts" }, { text: "Holding hands while we walk", style: "touch" }],
  [{ text: "You taking something off my plate when I'm stressed", style: "help" }, { text: "A back rub after a long day", style: "touch" }],
];

/** On the Same Page: life questions, four options each. */
export const SAME_PAGE: { q: string; options: [string, string, string, string] }[] = [
  { q: "When we disagree, I'd rather…", options: ["Talk it out right away", "Cool off first, then talk", "Sleep on it", "Let it go quietly"] },
  { q: "Money in a relationship should be…", options: ["All joint", "Joint for bills, the rest separate", "Mostly separate", "Whoever earns more pays more"] },
  { q: "How many children would you like?", options: ["None", "One or two", "Three or four", "As many as God gives"] },
  { q: "Where would you most like us to live?", options: ["A big city", "A quiet town", "Abroad", "Close to family"] },
  { q: "How often should we visit family?", options: ["Most weekends", "Once a month", "Festive seasons", "Only when we must"] },
  { q: "Our ideal weekend looks like…", options: ["Out with friends", "Home, just us", "Worship and family", "Travelling somewhere"] },
  { q: "In our home, who cooks?", options: ["Me", "You", "Both of us, together", "We order in"] },
  { q: "The perfect December is…", options: ["Detty December in the city", "Back to the village", "Somewhere new abroad", "Staying home to rest"] },
  { q: "How much time alone do you need?", options: ["Hardly any", "An hour a day", "A day a week", "Quite a lot"] },
  { q: "Phones and passwords between us…", options: ["Totally open", "Shared if asked", "Private is private", "We've never talked about it"] },
  { q: "Us on social media…", options: ["Post everything", "Post now and then", "Keep it private", "Soft launches only"] },
  { q: "Our wedding (or dream wedding) is…", options: ["A big owambe", "Small and intimate", "Registry, then a party", "Just the two of us"] },
  { q: "Faith in our home should be…", options: ["Right at the centre", "Important but relaxed", "Personal for each of us", "Not a big part"] },
  { q: "Saving versus spending…", options: ["Save first, always", "A careful balance", "Enjoy now, save later", "Depends on the month"] },
  { q: "When family gives advice about us…", options: ["We listen, then decide together", "We politely ignore it", "Each handles their own family", "Depends on the issue"] },
  { q: "Pets at home?", options: ["Yes, a dog", "Yes, a cat", "Maybe one day", "No pets"] },
  { q: "If one of us got a great job in another city…", options: ["We move together", "We try long distance", "We stay put", "We decide when it happens"] },
  { q: "Chores should be…", options: ["Split evenly", "Done by whoever has time", "Handled by paid help", "Fixed jobs for each of us"] },
  { q: "Going out or staying in?", options: ["Out most nights", "Out at weekends", "Mostly in", "Depends on the mood"] },
  { q: "The best way to celebrate a birthday…", options: ["A big party", "Dinner for two", "A trip away", "Low-key, just us"] },
];

/** Don't Laugh: the performer acts it out; the other tries to keep a straight face. */
export const DONT_LAUGH: string[] = [
  "Deliver tomorrow's weather forecast like a Nollywood villain.",
  "Give a dramatic church announcement about your partner's snoring.",
  "Read the last message you received like breaking news on NTA.",
  "Do a slow, serious talk-show interview of your partner about their worst haircut.",
  "Recite a famous Afrobeats chorus like a disappointed school principal.",
  "Roast your partner for 20 seconds, then apologise like a politician.",
  "Act out a movie trailer for \"The Day NEPA Took Light\".",
  "Sell your partner a bag of pure water like it's a luxury item.",
  "Narrate your partner making tea like a nature documentary.",
  "Explain how to cook jollof like it's a top-secret military briefing.",
  "Propose to your partner like a desperate Nollywood lover in the rain.",
  "Be a danfo conductor calling out bus stops in your living room.",
  "Give a motivational speech to a cockroach you're about to kill.",
  "Do a slow-motion replay of yourself missing a bus.",
  "Introduce your partner like a boxer walking into the ring.",
  "Read a shopping list out loud like a love poem.",
  "Be an aunty at a wedding asking your partner when they'll marry.",
  "Haggle at the market for something that's already free.",
  "Do your best impression of a phone on 1% battery.",
  "Give a tour of your kitchen like an estate agent selling a mansion.",
  "Be a pastor announcing that the generator has run out of fuel.",
  "Make your entrance like a celebrity arriving at an awards show.",
  "Explain the offside rule like a worried grandmother.",
  "Be the last puff-puff at a party, begging not to be eaten.",
  "Report live from the scene of a missing TV remote.",
  "Review your partner's cooking like a very posh food critic.",
  "Sing \"Happy Birthday\" like the saddest song ever written.",
  "Give a heartfelt eulogy for your phone charger.",
  "Dance like an uncle when his favourite song comes on.",
  "Teach a short class on how to sleep properly.",
];
