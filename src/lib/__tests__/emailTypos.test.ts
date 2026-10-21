import { describe, expect, it } from "vitest";
import { suggestEmail } from "../emailTypos";

describe("email typo suggestions", () => {
  it("catches the common slips", () => {
    expect(suggestEmail("pureentertainmenthouse@gmail.co")).toBe("pureentertainmenthouse@gmail.com");
    expect(suggestEmail("ada@gmial.com")).toBe("ada@gmail.com");
    expect(suggestEmail("ada@gmail.con")).toBe("ada@gmail.com");
    expect(suggestEmail("ada@gmal.com")).toBe("ada@gmail.com");
    expect(suggestEmail("ada@yahoo.con")).toBe("ada@yahoo.com");
    expect(suggestEmail("ada@hotmial.com")).toBe("ada@hotmail.com");
    expect(suggestEmail("ada@outlok.com")).toBe("ada@outlook.com");
    expect(suggestEmail("Ada@GMAIL.CO")).toBe("Ada@gmail.com");
  });

  it("leaves correct and unfamiliar addresses alone", () => {
    expect(suggestEmail("ada@gmail.com")).toBeNull();
    expect(suggestEmail("ada@yahoo.co.uk")).toBeNull();
    expect(suggestEmail("stacktechnologies0@gmail.com")).toBeNull();
    expect(suggestEmail("ada@stackcoding.ng")).toBeNull();
    expect(suggestEmail("ada@unilag.edu.ng")).toBeNull();
    expect(suggestEmail("not-an-email")).toBeNull();
  });
});
