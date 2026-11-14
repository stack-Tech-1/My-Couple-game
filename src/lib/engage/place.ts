import { levelOf, xpOf, type Stats } from "@/lib/progress/model";

/**
 * "Our place": a couple's room that fills up as they do things together. Every item is earned
 * from what they've already done (room_progress), never bought, and nothing new is stored.
 */
export type PlaceItem = {
  id: string;
  name: string;
  /** What earns it, in plain words. */
  how: string;
  value: (s: Stats) => number;
  target: number;
};

export const PLACE_ITEMS: PlaceItem[] = [
  { id: "sofa", name: "A sofa", how: "3 days together", value: (s) => s.shared_days, target: 3 },
  { id: "photo", name: "Your first photo on the wall", how: "a photo in Memory Lane", value: (s) => s.memories, target: 1 },
  { id: "curtains", name: "Red curtains", how: "a love note", value: (s) => s.notes, target: 1 },
  { id: "rug", name: "A woven rug", how: "10 games together", value: (s) => s.games, target: 10 },
  { id: "certificate", name: "Your level on the wall", how: "reaching level 2", value: (s) => levelOf(xpOf(s)).level, target: 2 },
  { id: "lamp", name: "A reading lamp", how: "50 messages", value: (s) => s.messages, target: 50 },
  { id: "plant_mid", name: "The plant grows", how: "a 7-day streak", value: (s) => s.best_streak, target: 7 },
  { id: "bookshelf", name: "A bookshelf", how: "10 daily questions answered together", value: (s) => s.dailies, target: 10 },
  { id: "cushions", name: "Ankara cushions", how: "14 days together", value: (s) => s.shared_days, target: 14 },
  { id: "table", name: "A table for Whot", how: "25 games together", value: (s) => s.games, target: 25 },
  { id: "radio", name: "A radio", how: "10 voice notes", value: (s) => s.voice, target: 10 },
  { id: "ludo", name: "A Ludo board", how: "5 different games", value: (s) => s.kinds, target: 5 },
  { id: "trophy", name: "A team trophy", how: "5 team-up wins", value: (s) => s.coop_wins, target: 5 },
  { id: "painting", name: "An adire painting", how: "today's word finished together on 10 days", value: (s) => s.words ?? 0, target: 10 },
  { id: "clock", name: "A wall clock", how: "30 days together", value: (s) => s.shared_days, target: 30 },
  { id: "plant_big", name: "The plant grows tall", how: "a 30-day streak", value: (s) => s.best_streak, target: 30 },
  { id: "lights", name: "Fairy lights", how: "a 30-day streak", value: (s) => s.best_streak, target: 30 },
  { id: "fan", name: "A ceiling fan", how: "50 games together", value: (s) => s.games, target: 50 },
  { id: "photo2", name: "A wall of photos", how: "10 photos in Memory Lane", value: (s) => s.memories, target: 10 },
  { id: "books", name: "A full bookshelf", how: "50 daily questions together", value: (s) => s.dailies, target: 50 },
  { id: "guitar", name: "A guitar", how: "20 nudges", value: (s) => s.nudges, target: 20 },
  { id: "tv", name: "A TV", how: "10 different games", value: (s) => s.kinds, target: 10 },
  { id: "board", name: "Your bucket list board", how: "something ticked off your bucket list", value: (s) => s.bucket_done, target: 1 },
  { id: "cat", name: "A cat moves in", how: "60 days together", value: (s) => s.shared_days, target: 60 },
  { id: "gold", name: "A gold frame", how: "100 games together", value: (s) => s.games, target: 100 },
  { id: "plant_flower", name: "The plant flowers", how: "a 100-day streak", value: (s) => s.best_streak, target: 100 },
];

export type PlaceState = { have: string[]; next: { item: PlaceItem; progress: number; left: number } | null; level: number };

export function placeOf(s: Stats): PlaceState {
  const have = PLACE_ITEMS.filter((i) => i.value(s) >= i.target).map((i) => i.id);
  // The next one: the closest to done among those not yet earned.
  const pending = PLACE_ITEMS.filter((i) => i.value(s) < i.target).map((i) => ({ item: i, progress: Math.max(0, i.value(s)) / i.target, left: i.target - Math.max(0, i.value(s)) }));
  pending.sort((a, b) => b.progress - a.progress || a.left - b.left);
  return { have, next: pending[0] ?? null, level: levelOf(xpOf(s)).level };
}
