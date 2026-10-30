import "server-only";

/**
 * Ọ̀rọ̀ of the Day answers. Server only: the day's word never reaches a phone before it's solved.
 * English answers are common, friendly words (no rude ones). Fridays use a Naija word, with a hint.
 */
export const ENGLISH = (
  "about above actor adapt admit adopt adult after again agent agree ahead alarm album alert alike alive allow alone along alter amaze among angel anger angle angry " +
  "apple apply arena argue arise array arrow aside asset audio avoid award aware awful bacon badge baker basic beach beard beast begin being below bench berry " +
  "birth black blade blame blank blast blend bless blind block bloom board boast bonus boost booth brain brand brave bread break bride brief bring broad brown " +
  "brush build bunch burst buyer cabin cable camel candy carry catch cause chain chair chalk charm chart chase cheap check cheek cheer chess chest chief child " +
  "chill choir chose civil claim class clean clear clerk click climb clock close cloth cloud coach coast color couch count court cover craft crane crash cream " +
  "crisp cross crowd crown curve cycle daily dance dated dealt debut delay depth diary dinner doubt dozen draft drama dream dress drink drive eager eagle early earth " +
  "eight elbow elder empty enjoy enter entry equal error essay event every exact exist extra faint faith false fancy feast fence ferry fever field fifty fight " +
  "final flame flash fleet float flock floor flour fluid focus force forty forum found frame fresh front frost fruit funny giant given glass globe glory glove grace " +
  "grade grain grand grant grape grass great green greet group guard guess guest guide habit happy harsh heart heavy hello honey honor horse hotel house human humor " +
  "ideal image index inner input issue ivory jelly jewel joint judge juice knife knock label laugh layer learn lemon level light limit linen lions local lodge logic " +
  "loose lover loyal lucky lunch magic major mango maple march match mayor medal media mercy merry metal meter minor model money month moral motor mount mouse " +
  "mouth movie music nerve never night noble noise north novel nurse ocean offer often olive onion opera orbit order organ other outer owner paint panel paper " +
  "party pasta patch peace peach pearl pedal phone photo piano piece pilot pitch pizza place plain plane plant plate plaza point polar pound power press price " +
  "pride prime print prize proof proud queen quick quiet quilt quite radio raise rally range rapid ratio reach ready relax reply rider ridge right river roast robot " +
  "round route royal rural salad sauce scale scene scent score scout sense serve seven shade shake shape share sharp sheep shelf shell shine shirt shoot shore short " +
  "shout sight silly skill skirt sleep slice slide smart smile smoke snack solid solve sound south space spark speak spice spoon sport squad staff stage stair stamp " +
  "stand start steam steel stone store storm story stove style sugar sunny super sweet swing table taste teach thank theme thick thing think three throw thumb tiger " +
  "title toast today tooth topic torch total touch tough tower track trade trail train treat trend trial tribe trick truck trust truth tulip uncle under unity until " +
  "upper urban usual valid value video visit vital vivid vocal voice wagon waste watch water whale wheat wheel while white whole widow width woman world worry worth " +
  "wound write yacht yield young youth zebra"
)
  .split(/\s+/)
  .filter((w) => w.length === 5);

/** Friday words: [word, hint]. Common Naija words, five letters. */
export const NAIJA: readonly (readonly [string, string])[] = [
  ["danfo", "The yellow bus of Lagos"],
  ["okada", "A motorbike taxi"],
  ["egusi", "Melon-seed soup"],
  ["amala", "A swallow made from yam flour"],
  ["garri", "Cassava flakes, soaked or made into eba"],
  ["akara", "Bean fritters, crisp from the oil"],
  ["ewedu", "A green, slippery soup"],
  ["agidi", "Corn pap wrapped in leaves"],
  ["akamu", "Pap, the morning drink"],
  ["banga", "Palm-nut soup"],
  ["ponmo", "Cow skin, in your soup"],
  ["shaki", "Tripe, in your stew"],
  ["adalu", "Beans and corn cooked together"],
  ["nsala", "White soup"],
  ["ofada", "Local rice with a spicy green stew"],
  ["molue", "The old big yellow bus"],
  ["amebo", "Someone who spreads gist"],
  ["gbedu", "The music, the vibe"],
  ["shayo", "Drinks, the party kind"],
  ["yanga", "Showing off"],
  ["naija", "Home"],
  ["iyawo", "A wife, a bride"],
  ["pikin", "A child"],
  ["wetin", "Pidgin for \"what\""],
  ["ojoro", "Cheating, not fair play"],
  ["gbege", "Trouble"],
  ["olori", "A queen, a king's wife"],
  ["apala", "A Yoruba music style"],
  ["ogene", "A metal gong"],
] as const;

const EPOCH = Date.UTC(2026, 0, 1);

/** A fixed shuffle so the order isn't alphabetical, the same on every server. */
function order(n: number, salt: number): number[] {
  const idx = Array.from({ length: n }, (_, i) => i);
  let x = salt;
  for (let i = n - 1; i > 0; i--) {
    x = (Math.imul(x ^ (x >>> 15), 2246822507) + 0x9e3779b9) >>> 0;
    const j = x % (i + 1);
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx;
}
const EN_ORDER = order(ENGLISH.length, 20261029);
const NG_ORDER = order(NAIJA.length, 1960);

/** The answer for a Lagos day ("2026-11-06"). */
export function oroAnswer(day: string): { word: string; naija: boolean; hint: string | null } {
  const t = Date.parse(`${day}T00:00:00Z`);
  const n = Math.floor((t - EPOCH) / 864e5);
  const friday = new Date(t).getUTCDay() === 5;
  if (friday) {
    const k = Math.floor(n / 7);
    const [word, hint] = NAIJA[NG_ORDER[((k % NAIJA.length) + NAIJA.length) % NAIJA.length]!]!;
    return { word, naija: true, hint };
  }
  const word = ENGLISH[EN_ORDER[((n % ENGLISH.length) + ENGLISH.length) % ENGLISH.length]!]!;
  return { word, naija: false, hint: null };
}

export type Mark = "hit" | "near" | "miss";

/** Right letter right place, right letter wrong place, or not in the word (repeats handled). */
export function markGuess(guess: string, answer: string): Mark[] {
  const out: Mark[] = Array(answer.length).fill("miss");
  const left: Record<string, number> = {};
  for (let i = 0; i < answer.length; i++) {
    if (guess[i] === answer[i]) out[i] = "hit";
    else left[answer[i]!] = (left[answer[i]!] ?? 0) + 1;
  }
  for (let i = 0; i < answer.length; i++) {
    if (out[i] === "hit") continue;
    const ch = guess[i]!;
    if (left[ch]) {
      out[i] = "near";
      left[ch]!--;
    }
  }
  return out;
}
