import type { QuizSource } from "@/games/quiz/logic";

/**
 * Emoji Guess: an Afrobeats song or a Nollywood film, told in emoji. Only titles are used (no
 * lyrics, clips or artwork). Wrong options are other titles of the same kind.
 */
const song = (q: string, a: string, note: string): QuizSource => ({ q, a, note, group: "song", ask: "Name the song" });
const film = (q: string, a: string, note: string): QuizSource => ({ q, a, note, group: "film", ask: "Name the film" });

export const EMOJI_GUESS: QuizSource[] = [
  song("🧴✨", "Essence", "Wizkid ft. Tems"),
  song("🍂⬇️", "Fall", "Davido"),
  song("😤➡️😌", "Calm Down", "Rema"),
  song("🔚🔚", "Last Last", "Burna Boy"),
  song("❤️🤏", "Love Nwantiti", "CKay"),
  song("🇵🇪", "Peru", "Fireboy DML"),
  song("🤖🔫", "Terminator", "Asake"),
  song("🏃🏾‍♀️💨", "Rush", "Ayra Starr"),
  song("🌍👸🏾", "African Queen", "2Baba"),
  song("🕵🏾‍♀️👨🏾❓", "Johnny", "Yemi Alade"),
  song("📵🙅🏾", "Unavailable", "Davido ft. Musa Keys"),
  song("🕊️🧠", "Free Mind", "Tems"),
  song("😈👉🏾", "Bad Influence", "Omah Lay"),
  song("📏🏃🏾", "Kilometre", "Burna Boy"),
  song("🦚💸", "Buga", "Kizz Daniel ft. Tekno"),
  song("💰,,,", "Commas", "Ayra Starr"),
  song("🧍🏾⛰️🔝", "Lonely at the Top", "Asake"),
  song("🍬👩🏾‍🍼", "Sweet Mother", "Prince Nico Mbarga"),
  song("🖼️👩🏽🎨", "Monalisa", "Lojay & Sarz"),
  film("💒🎉", "The Wedding Party", "2016"),
  film("👑👦🏾", "King of Boys", "2018"),
  film("🦁❤️", "Lionheart", "2018"),
  film("🗓️ 1/10 🇳🇬", "October 1", "2014"),
  film("½🟡☀️", "Half of a Yellow Sun", "2013"),
  film("⛓️🏠", "Living in Bondage", "1992"),
  film("🧓🏾✈️🇬🇧", "Osuofia in London", "2003"),
  film("📱🔁📱", "Phone Swap", "2012"),
  film("3️⃣0️⃣📅🇺🇸", "30 Days in Atlanta", "2014"),
  film("⚔️🍲🛣️", "Battle on Buka Street", "2022"),
  film("💀👜", "Anikulapo", "2022"),
  film("📕⬛", "The Black Book", "2023"),
  film("🔫🌆", "Gangs of Lagos", "2023"),
  film("🗿", "The Figurine", "2009"),
  film("🎩👴🏾💰", "Chief Daddy", "2018"),
  film("👩🏾👦🏾👦🏾👦🏾👦🏾👦🏾", "A Tribe Called Judah", "2023"),
  film("🐎👑", "Elesin Oba: The King's Horseman", "2022"),
  film("👬🔫", "Brotherhood", "2022"),
];
