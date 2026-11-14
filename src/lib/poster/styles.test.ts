import { describe, expect, it } from "vitest";
import { POSTER_STYLES, defaultStyle, filmTitle, fitSize, numberWord, posterSvg, type PosterData } from "./styles";

const base: PosterData = {
  people: [{ name: "Ada", motif: "bloom", hue: 12 }, { name: "Tobi", motif: "comet", hue: 200 }],
  level: { number: 6, name: "Soulmates" },
  headline: null,
  stats: [{ value: "47", label: "days in a row" }, { value: "128", label: "games together" }],
  rivalry: { label: "Wins", scores: [31, 27] },
  game: "Whot",
  year: 2026,
  photo: null,
  seed: "x",
};

describe("share posters", () => {
  it("draws every style, for a couple, one person, and with a photo", () => {
    const solo: PosterData = { ...base, people: [base.people[0]!], level: null, headline: "New best: 2,400", rivalry: null };
    const photo: PosterData = { ...base, photo: "data:image/jpeg;base64,AAAA" };
    for (const d of [base, solo, photo])
      for (const s of POSTER_STYLES) {
        const svg = posterSvg(s, d);
        expect(svg.startsWith("<svg")).toBe(true);
        expect(svg.endsWith("</svg>")).toBe(true);
        expect(svg.toLowerCase()).toContain("playamah.app");
      }
    expect(posterSvg("studio", photo)).toContain("data:image/jpeg");
    expect(posterSvg("studio", base)).not.toContain("<image");
  });

  it("escapes names, so a name can never break the picture or inject anything", () => {
    const d: PosterData = { ...base, people: [{ name: `<script>alert("x")</script>`, motif: "fig", hue: 1 }, { name: "Tobi & Co", motif: "x", hue: 2 }] };
    for (const s of POSTER_STYLES) {
      const svg = posterSvg(s, d);
      expect(svg.toLowerCase()).not.toContain("<script");
      expect(svg.toLowerCase()).toContain("&lt;script&gt;");
      expect(svg).not.toMatch(/Tobi & Co|TOBI & CO/);
    }
  });

  it("picks a sensible first style and shrinks long text to fit", () => {
    expect(defaultStyle({ ...base, photo: "data:x" })).toBe("studio");
    expect(defaultStyle(base)).toBe("nollywood");
    expect(defaultStyle({ ...base, rivalry: null })).toBe("owambe");
    expect(defaultStyle({ ...base, rivalry: null, people: [base.people[0]!] })).toBe("danfo");
    expect(fitSize("ADA", 220, 940, 0.78)).toBe(220);
    expect(fitSize("A VERY LONG NAME INDEED", 220, 940, 0.78)).toBeLessThan(60);
    expect(numberWord(6)).toBe("Six");
    expect(numberWord(31)).toBe("31");
    expect(filmTitle("Whot")).toBe("Whot Wahala");
    expect(filmTitle("Riddle Me This")).toBe("Riddle Me This Palava");
  });
});
