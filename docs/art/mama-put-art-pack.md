# Mama Put art pack

This pack is for making the Mama Put pictures with an AI image tool. Make every picture on the list, save each one under its exact file name, and send me the folder. I'll compress them, put them into the game and add the movement (steam, coins, bouncing).

---

## Before you start

**Which tool to use**
- Use **ChatGPT** (its image generator) if you can. It can make transparent backgrounds, and it keeps the style steady when you work in one chat.
- **Midjourney** also works, with two differences:
  - Its backgrounds aren't transparent, so you'd remove them afterwards with a free background remover (for example remove.bg).
  - To keep the style the same, add `--sref` with your master scene picture to each prompt.

**How to keep everything looking like one set (the most important part)**
1. Do **Step 1** first. Make the master scene, regenerate until you love it, and save it as `00-master.png`.
2. Make every other picture **in the same ChatGPT chat**, starting each request with: *"In exactly the same art style as the master scene above, …"*.
3. Paste the **Style lock** (below) at the end of every prompt.
4. Make 2 to 4 versions of each picture and keep the best one.
5. Lay the finished pictures side by side. If one looks different from the rest (outline thickness, light direction, colours), redo it.

**Rules for every picture**
- **No writing inside the pictures.** AI tools spell words badly, so the game adds signboard text and labels itself.
- **Light always comes from the top left.**
- **Kitchen items** (pots, trays, the pan) are seen **from a little above, at an angle**: you can see the food on top and the side of the pot.
- **Customers** are seen **from the front, from the waist up**, all at the same size and position in the frame.
- **Transparent background** for everything except the three backgrounds.
- Don't name other games in prompts. Describe the style instead, the way the Style lock does.

---

## Style lock (paste at the end of every prompt)

> Style: glossy hand-painted casual mobile game art, rich warm saturated colours, soft shading with gentle highlights and soft rim light, clean subtle dark-brown outlines, appetising and cheerful, Nigerian setting, consistent lighting from the top left. No text, no letters, no watermark.

Add this line for every item except the three backgrounds:

> Isolated single object, centred, transparent background, no shadow on the ground.

---

## Step 1: master scene (sets the style)

**File:** `00-master.png` (any size, wide)

> A cheerful busy Nigerian buka (Mama Put food stall) at lunchtime, seen from the front like a mobile cooking game. Back wall painted two-tone: warm yellow on top, teal green at the bottom. A wooden beam with a blank signboard across the top, a small window showing a yellow danfo bus outside, a warm hanging bulb. A long polished wooden counter across the middle with three white plates on it. Three smiling Nigerian customers in colourful ankara standing behind the counter, waist up. In front of the counter, seen from slightly above: big pots of jollof rice, a blue party cooler of white rice, a red enamel pot of tomato stew, a pot of egusi soup, a steel tray of beef, fried chicken and fried fish, a bowl of eba, plantain (dodo) frying in a pan on a gas burner, moin moin in leaves, a red crate of cold soft drinks. + Style lock

Keep regenerating until it really looks like the game you want. Everything else copies this picture.

---

## Step 2: backgrounds (no transparency)

| File | Size | Prompt |
|---|---|---|
| `bg-wall.png` | 1200 × 700 | The back wall of a Nigerian buka with no people, front view. Two-tone painted wall (warm yellow top, teal bottom), a wooden beam with a blank cream signboard across the top, a small window on the right showing a yellow danfo bus and Lagos buildings, a warm hanging bulb in the middle casting soft light. Keep the middle area plain, because customers will stand there. + Style lock |
| `counter.png` | 1200 × 260, transparent above the counter | A long polished wooden food counter seen from the front at a slight downward angle, with visible wood grain and a lighter top edge, nothing on it. Transparent background above the counter. + Style lock |
| `bg-kitchen.png` | 1200 × 1400 | The kitchen area of a Nigerian buka seen from slightly above. Clean cream tiled wall with three long stainless steel shelves going across, evenly spaced, all empty. + Style lock |

---

## Step 3: customers (18 pictures)

Six characters, each with three moods. **The same character must look identical in all three moods**: same clothes, same pose and same framing. Only the face (and arms, for angry) changes.

**Size:** 600 × 700, transparent, waist up, centred, front view, all characters the same size in the frame.

**The characters**
1. `cust-aunty`: a cheerful market woman in her 40s, pink gele, blue and yellow ankara buba, gold earrings.
2. `cust-fila`: a young man in his 20s, purple fila cap, green and gold ankara shirt.
3. `cust-corper`: a young NYSC corps member in a khaki uniform and khaki cap.
4. `cust-student`: a university student woman with long braids, a casual T-shirt and headphones around her neck.
5. `cust-oga`: an office man in his 30s, low haircut, white shirt and tie, ID card lanyard.
6. `cust-baba`: an elderly man with a short white beard, glasses, a brown fila and a native agbada top.

**The moods (one file per character per mood)**
- `-wait`: a calm, neutral face, looking slightly down at the counter as if waiting for food.
- `-happy`: a big joyful smile with eyes squeezed shut and cheeks raised, as if just served great food.
- `-angry`: frowning, eyebrows down, a small sweat drop, arms crossed, as if waiting too long.

**Files:** `cust-aunty-wait.png`, `cust-aunty-happy.png`, `cust-aunty-angry.png`, and the same three moods for each of the other five characters.

**Prompt pattern**
> A [character description], waist-up front view, [mood description], a friendly Nigerian mobile game character. + Style lock + isolated line

---

## Step 4: kitchen stations (seen from slightly above)

**Size:** 512 × 512, transparent.

| File | Prompt |
|---|---|
| `st-jollof.png` | A big dark aluminium cooking pot full of glossy orange-red Nigerian jollof rice with a few green peas and peppers, steam rising, a metal serving spoon resting in it. |
| `st-rice.png` | A blue and white round party food cooler (warmer) with its lid off, full of fluffy white rice. |
| `st-stew.png` | A red enamel cooking pot full of thick red Nigerian tomato stew with shiny orange oil on top and a few pieces of meat. |
| `st-egusi.png` | A silver cooking pot full of Nigerian egusi soup: yellow-green with ground melon seeds and dark green leafy vegetables. |
| `st-beef.png` | A stainless steel tray section full of fried brown Nigerian beef chunks. |
| `st-chicken.png` | A stainless steel tray section full of golden fried chicken drumsticks. |
| `st-fish.png` | A stainless steel tray section with two whole fried fish (golden brown). |
| `st-eba.png` | A red plastic bowl full of round balls of yellow eba (garri swallow), wrapped in clear nylon. |
| `st-moin.png` | A woven basket full of moin moin wrapped in green leaves, one unwrapped showing the orange-pink inside. |
| `st-drinks.png` | A red plastic crate full of cold glass soft-drink bottles (green, brown and clear), with water droplets. |
| `st-bin.png` | A small dark grey kitchen bin. |
| `st-stove.png` | A black two-burner gas stove top with blue flames, seen from slightly above. |

**The frying pan:** five pictures. All five must show the same pan at the same angle; only the plantain changes.

| File | Prompt |
|---|---|
| `pan-empty.png` | A black frying pan with hot oil, empty. |
| `pan-raw.png` | The same frying pan with fresh pale yellow raw plantain slices. |
| `pan-frying.png` | The same frying pan with plantain slices turning golden, small oil bubbles. |
| `pan-ready.png` | The same frying pan with perfectly golden-brown fried plantain (dodo). |
| `pan-burnt.png` | The same frying pan with burnt black-brown plantain and a small wisp of smoke. |

---

## Step 5: plate and food portions

These pieces are stacked on a plate as the player dishes each food, so each portion must look right sitting on a white plate, seen from slightly above.

| File | Size | Prompt |
|---|---|---|
| `plate.png` | 512 × 256 | An empty round white ceramic plate seen from slightly above. |
| `p-jollof.png` | 256 × 256 | A single serving scoop of jollof rice. |
| `p-rice.png` | 256 × 256 | A single serving scoop of white rice. |
| `p-stew.png` | 256 × 256 | A ladle-sized pool of red tomato stew. |
| `p-eba.png` | 256 × 256 | One smooth ball of yellow eba. |
| `p-egusi.png` | 256 × 256 | A small pool of egusi soup. |
| `p-beef.png` | 256 × 256 | Two pieces of fried beef. |
| `p-chicken.png` | 256 × 256 | One golden fried chicken drumstick. |
| `p-fish.png` | 256 × 256 | One fried fish. |
| `p-dodo.png` | 256 × 256 | Four slices of golden fried plantain. |
| `p-moin.png` | 256 × 256 | One moin moin, leaf opened. |
| `p-drink.png` | 256 × 256 | One cold glass soft-drink bottle, upright. |

The same portion pictures also appear, smaller, in the customers' order bubbles.

---

## Step 6: little extras

| File | Size | Prompt |
|---|---|---|
| `coin.png` | 256 × 256 | One shiny gold coin, slightly tilted. |
| `mama-happy.png` | 600 × 700 | The buka owner, a warm plump Nigerian woman in her 50s with an apron and a headscarf, waist up, laughing and giving a thumbs up. |
| `mama-sad.png` | 600 × 700 | The same woman, hands on her hips, shaking her head kindly, as if saying "try again". |

---

## Checklist before sending

- [ ] 54 files in total: `00-master.png`, 3 backgrounds, 18 customers, 12 stations, 5 pans, 12 plate and food pieces, 3 extras.
- [ ] File names are exactly as listed (lowercase, with dashes).
- [ ] Everything except the backgrounds has a transparent background.
- [ ] No writing anywhere in the pictures.
- [ ] Laid side by side, they all look like the same game.

**Send them by** putting the folder in the project at `art-src/mama-put/`, or anywhere else, and tell me the path. PNG at full size is fine; I'll shrink everything to about 300 to 400 KB in total for the game.

## Tips

- If a customer's three moods come out looking like different people, generate the `-wait` picture first. Then ask: *"Same person, same clothes, same pose, but now [mood]."*
- If ChatGPT adds a shadow or floor, say: *"Remove the floor and shadow, transparent background only."*
- You don't need all 54 at once. Send the master scene, the wall, the counter, one customer and two pots first, and I'll put them into the game so we can judge the look early, before you make everything.
