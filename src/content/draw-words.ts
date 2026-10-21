/**
 * Draw & Guess prompts. Concrete, drawable, fun to watch someone struggle with.
 * Grouped loosely by difficulty; the game offers one from each band per turn.
 */
export const DRAW_WORDS = {
  easy: [
    "apple", "banana", "balloon", "bicycle", "boat", "book", "bridge", "butterfly", "cactus", "cake", "camera", "candle",
    "car", "carrot", "castle", "cat", "chair", "cheese", "cloud", "cookie", "crown", "cup", "dog", "door", "duck",
    "egg", "envelope", "eye", "feather", "fish", "flower", "fork", "frog", "ghost", "glasses", "guitar", "hat", "heart",
    "house", "ice cream", "key", "kite", "ladder", "leaf", "lemon", "lighthouse", "lollipop", "moon", "mountain",
    "mushroom", "octopus", "owl", "pear", "pencil", "pizza", "rainbow", "robot", "rocket", "sandwich", "shoe",
    "snail", "snake", "snowman", "sock", "spider", "star", "sun", "sunflower", "sword", "teapot", "tent", "tree",
    "umbrella", "volcano", "whale", "window",
  ],
  medium: [
    "anchor", "astronaut", "backpack", "barbecue", "beehive", "binoculars", "birthday", "bowling", "campfire",
    "carousel", "chandelier", "compass", "crocodile", "dinosaur", "dragon", "dreamcatcher", "elevator", "ferris wheel",
    "fireworks", "flamingo", "giraffe", "hammock", "headphones", "hedgehog", "helicopter", "hot air balloon",
    "jellyfish", "kangaroo", "football", "lipstick", "mermaid", "microphone", "parachute", "peacock",
    "penguin", "piano", "pirate", "popcorn", "rollercoaster", "sailboat", "scarecrow", "seesaw", "skateboard",
    "sloth", "submarine", "meat pie", "swing", "telescope", "tornado", "treasure", "unicorn", "UI's main gate", "waterfall",
    "windmill", "wizard", "bottle of Coke", "skeleton",
  ],
  hard: [
    "jet lag", "brain freeze", "first date", "honeymoon", "breakfast in bed", "slow dance", "road trip", "sleepwalking",
    "stargazing", "pillow fight", "thunderstorm", "bad hair day", "morning person", "photobomb", "hide and seek",
    "karaoke", "hiccups", "sunburn", "procrastination", "déjà vu", "selfie", "time travel", "rush hour", "wedding cake",
    "snooze button", "picnic", "sandcastle", "midnight snack", "lost luggage", "surprise party", "puppy love",
    "silent disco", "beach volleyball", "spa day",
  ],
} as const;