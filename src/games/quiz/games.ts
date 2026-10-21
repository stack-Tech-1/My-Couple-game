import { RIDDLES } from "@/content/riddles";
import { NAIJA_TRIVIA } from "@/content/naija-trivia";
import { PIDGIN } from "@/content/pidgin";
import { EMOJI_GUESS } from "@/content/emoji-guess";
import { makeQuiz, QUIZ_COUNT } from "./logic";

const howItWorks = (what: string) => ({
  title: "How it works",
  body: [`${QUIZ_COUNT} ${what}, the same for everyone playing. Pick one of four answers.`, "The right answer shows once everyone has picked, so no copying."],
});
const scoring = { title: "Scoring", body: ["A point for every right answer. Most points wins; level points is a tie."] };

export const riddles = makeQuiz({
  id: "riddles",
  estimatedMinutes: 6,
  maxPlayers: 8,
  ask: "Riddle me this",
  bank: () => RIDDLES,
  rules: { summary: "Simple words, twisted answers. Some of them sound naughtier than they are.", sections: [howItWorks("riddles"), scoring] },
});

export const naijaTrivia = makeQuiz({
  id: "naija-trivia",
  estimatedMinutes: 6,
  ask: "Naija trivia",
  bank: () => NAIJA_TRIVIA,
  rules: { summary: "Places, festivals, books and history. How Naija are you, really?", sections: [howItWorks("questions"), scoring] },
});

export const pidginPalava = makeQuiz({
  id: "pidgin-palava",
  estimatedMinutes: 4,
  ask: "Wetin e mean?",
  bank: () => PIDGIN,
  rules: { summary: "A Pidgin word or phrase. Pick what it means.", sections: [howItWorks("words and phrases"), scoring] },
});

export const emojiGuess = makeQuiz({
  id: "emoji-guess",
  estimatedMinutes: 5,
  look: "emoji",
  ask: "Name it",
  bank: () => EMOJI_GUESS,
  rules: { summary: "Afrobeats hits and Nollywood favourites, told in emoji.", sections: [howItWorks("emoji clues"), scoring] },
});
