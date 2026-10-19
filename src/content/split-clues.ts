/**
 * Split Clues puzzles. Original. Each half is useless alone: the answer needs
 * something only the other player can see. Answers are compared alphanumerics-only,
 * so "7:45", "7.45" and "745" all match; `accept` lists any other fair spellings.
 */
export type Puzzle = {
  id: string;
  title: string;
  setup: string;
  /** Clue cards for seat A and seat B. */
  a: string[];
  b: string[];
  answer: string;
  accept?: string[];
  hint: string;
  /** What the answer box asks for. */
  ask: string;
};

export const PUZZLES: Puzzle[] = [
  {
    id: "padlock",
    title: "The Padlock",
    setup: "A little padlock on a memory box. Four digits. Someone in this house is sentimental.",
    a: ["A sticky note on the box: “Our anniversary, day first.”", "On the calendar, the 14th is circled in red ink, twice."],
    b: ["A postcard on the fridge: “A whole year since that rainy February.”", "The padlock only takes digits. No slashes, no dots."],
    answer: "1402",
    hint: "Day, then month, two digits each.",
    ask: "Four digits",
  },
  {
    id: "red-fox",
    title: "The Reservation",
    setup: "You booked somewhere for tonight and neither of you remembers the name. The taxi driver is waiting.",
    a: ["A text from the restaurant: “First word: the colour of a ripe tomato.”", "…and: “Last word: a small hotel with a bar, three letters.”"],
    b: ["A second text: “Middle word: the clever orange animal on our menu.”", "The name is three words long."],
    answer: "red fox inn",
    accept: ["the red fox inn"],
    hint: "Colour, animal, a three-letter place to stay.",
    ask: "The restaurant's name",
  },
  {
    id: "map",
    title: "X Marks the Spot",
    setup: "An old treasure map, torn neatly in half. Rows are lettered A–E, columns numbered 1–5.",
    a: ["Scrawled on this half: “The treasure lies in the same row as the lighthouse.”", "This half shows the lighthouse in row C."],
    b: ["Scrawled on this half: “Walk two columns east of the old well.”", "This half shows the well in column 2."],
    answer: "c4",
    hint: "Row letter, then column number. East means the number goes up.",
    ask: "A grid square, like B3",
  },
  {
    id: "safe",
    title: "The Safe",
    setup: "A hotel safe with three dials. The previous guest left notes in two different rooms.",
    a: ["Dial one: the number of legs on a spider.", "Dial three: dial one minus dial two."],
    b: ["Dial two: the number of days in a week.", "Enter all three numbers in order."],
    answer: "871",
    accept: ["8-7-1", "8 7 1"],
    hint: "A spider has eight legs.",
    ask: "Three numbers",
  },
  {
    id: "postcard",
    title: "The Postcard",
    setup: "A postcard in a strange alphabet arrives with no return address.",
    a: ["The postcard reads: KHOOR ORYH"],
    b: ["Tucked inside the envelope: “Every letter has stepped forward three places. Walk them back.”", "So D becomes A, E becomes B, and so on."],
    answer: "hello love",
    hint: "K → H. Keep going.",
    ask: "The secret message",
  },
  {
    id: "clock",
    title: "The Clock Tower",
    setup: "The town clock stopped the night you met. What time did it stop?",
    a: ["The hour hand stopped on the hour the bakery opens.", "Write the time like 3:15."],
    b: ["The bakery's sign: “Fresh bread from 7 every morning.”", "The minute hand points straight at the 9."],
    answer: "745",
    accept: ["7:45", "0745"],
    hint: "The minute hand on 9 means 45 minutes.",
    ask: "A time, like 3:15",
  },
  {
    id: "paint",
    title: "The Colour Door",
    setup: "A door with a colour wheel for a lock. A painted sign: “Mix the two walls.”",
    a: ["The left wall of the hallway is painted blue."],
    b: ["The right wall of the hallway is painted yellow."],
    answer: "green",
    hint: "Primary school art class.",
    ask: "A colour",
  },
  {
    id: "cake",
    title: "Who Took the Cake?",
    setup: "Someone ate the birthday cake. The suspects: Mira, Ben and Cleo.",
    a: ["The thief has frosting on their sleeve.", "Ben's sleeves are spotless. He's been ironing all day."],
    b: ["Cleo was at the cinema all evening. She has the ticket stub.", "The thief was in the kitchen this evening."],
    answer: "mira",
    hint: "Rule out the clean sleeves and the cinema-goer.",
    ask: "The culprit's name",
  },
  {
    id: "recipe",
    title: "Grandma's Recipe",
    setup: "The family recipe is missing its secret ingredient, and grandma is enjoying your panic.",
    a: ["Grandma whispers: “It's sour.”", "“And only one thing in the pantry is.”"],
    b: ["The pantry shelf: honey, chilli, salt, lemon, cinnamon."],
    answer: "lemon",
    accept: ["lemons"],
    hint: "Sweet, hot, salty, sour, warm.",
    ask: "The secret ingredient",
  },
  {
    id: "platform",
    title: "The Night Train",
    setup: "Two tickets, one train, a station with twelve platforms and no departure board.",
    a: ["The guard says: “Your platform number is the number of letters in the destination.”"],
    b: ["Your tickets are to the city with the Eiffel Tower."],
    answer: "5",
    accept: ["five", "platform 5"],
    hint: "Count the letters in the city's name.",
    ask: "Platform number",
  },
];
