"use client";

import type { ComponentType } from "react";
import type { GameProps } from "./_engine/types";
import { GAME_LOGIC } from "./logic";
import { ConnectFourBoard } from "./connect-four/Board";
import { ChessBoard } from "./chess/Board";
import { TicTacToeBoard } from "./tic-tac-toe/Board";
import { DraughtsBoard } from "./draughts/Board";
import { NaijaLandlordBoard } from "./naija-landlord/Board";
import { SpellAmBoard } from "./spell-am/Board";
import { WhotTable } from "./whot/Table";
import { LudoBoard } from "./ludo/Board";
import { AyoBoard } from "./ayo/Board";
import { WordDuelBoard } from "./word-duel/Board";
import { ReflexBoard } from "./reflex-duel/Board";
import { DrawGuessBoard } from "./draw-guess/Board";
import { KnowMeTriviaBoard } from "./know-me-trivia/Board";
import { SplitCluesBoard } from "./split-clues/Board";
import { InSyncBoard } from "./in-sync/Board";
import { MemoryMatchBoard } from "./memory-match/Board";
import { BeatTheClockBoard } from "./beat-the-clock/Board";
import { HowWellBoard } from "./how-well/Board";
import { ThisOrThatBoard } from "./this-or-that/Board";
import { StoryChainBoard } from "./story-chain/Board";
import { DeepQuestionsBoard } from "./deep-questions/Board";
import { ComplimentBattleBoard } from "./compliment-battle/Board";
import { TruthOrDareBoard, SpicyDiceBoard, HotSeatBoard, NeverHaveIBoard } from "./after-dark/Boards";
import { QuizBoard } from "./quiz/Board";
import { LoveStylesBoard } from "./love-styles/Board";
import { SamePageBoard } from "./same-page/Board";
import { DontLaughBoard } from "./dont-laugh/Board";
import { MostLikelyBoard } from "./most-likely/Board";

/**
 * Client registry: game id -> component. Logic comes from the server-safe
 * GAME_LOGIC registry so the two halves can never drift apart.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- heterogeneous registry, each component is typed at its definition
const components: Record<string, ComponentType<GameProps<any, any>>> = {
  "connect-four": ConnectFourBoard,
  chess: ChessBoard,
  "tic-tac-toe": TicTacToeBoard,
  draughts: DraughtsBoard,
  "naija-landlord": NaijaLandlordBoard,
  "spell-am": SpellAmBoard,
  whot: WhotTable,
  ludo: LudoBoard,
  ayo: AyoBoard,
  "word-duel": WordDuelBoard,
  "reflex-duel": ReflexBoard,
  "draw-guess": DrawGuessBoard,
  "know-me-trivia": KnowMeTriviaBoard,
  "split-clues": SplitCluesBoard,
  "in-sync": InSyncBoard,
  "memory-match": MemoryMatchBoard,
  "beat-the-clock": BeatTheClockBoard,
  "how-well": HowWellBoard,
  "this-or-that": ThisOrThatBoard,
  "story-chain": StoryChainBoard,
  "deep-questions": DeepQuestionsBoard,
  "compliment-battle": ComplimentBattleBoard,
  "truth-or-dare": TruthOrDareBoard,
  "spicy-dice": SpicyDiceBoard,
  "hot-seat": HotSeatBoard,
  "never-have-i": NeverHaveIBoard,
  riddles: QuizBoard,
  "naija-trivia": QuizBoard,
  "pidgin-palava": QuizBoard,
  "emoji-guess": QuizBoard,
  "love-styles": LoveStylesBoard,
  "same-page": SamePageBoard,
  "dont-laugh": DontLaughBoard,
  "most-likely": MostLikelyBoard,
};

export function gameComponent(id: string) {
  return GAME_LOGIC[id] ? components[id] : undefined;
}