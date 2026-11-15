"""
Take the painted backdrop off AI-made art sheets, so cutout.mjs can split them by transparency.

Some sheets come back with a grey or black studio backdrop, smudged and only partly see-through,
which no colour rule separates cleanly from grey steel pots, white plates and black TVs. This runs
a background-removal model (rembg) over the whole sheet and writes a PNG with real transparency.

    python scripts/art/unbackdrop.py "game images/sheet.png" ... --out "game images/clean"

Needs: pip install rembg. The model (u2net, about 170 MB) downloads once, on first use.
"""
import argparse
import os
import sys

from PIL import Image
from rembg import new_session, remove


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("sheets", nargs="+")
    ap.add_argument("--out", required=True)
    ap.add_argument("--model", default="u2net")
    # "3x3": clean each cell of the grid on its own; busy sheets lose items in one pass.
    ap.add_argument("--grid", default="")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)
    session = new_session(args.model)
    for path in args.sheets:
        img = Image.open(path).convert("RGB")
        if args.grid:
            cols, rows = (int(n) for n in args.grid.split("x"))
            cut = Image.new("RGBA", img.size, (0, 0, 0, 0))
            for r in range(rows):
                for c in range(cols):
                    box = (img.width * c // cols, img.height * r // rows, img.width * (c + 1) // cols, img.height * (r + 1) // rows)
                    cut.paste(remove(img.crop(box), session=session, post_process_mask=True), box[:2])
        else:
            cut = remove(img, session=session, post_process_mask=True)
        dest = os.path.join(args.out, os.path.basename(path))
        cut.save(dest)
        print("clean:", dest)
    return 0


if __name__ == "__main__":
    sys.exit(main())
