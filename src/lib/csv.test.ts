import { describe, expect, it } from "vitest";
import { toCsv } from "./csv";

describe("toCsv", () => {
  it("quotes commas, quotes and new lines", () => {
    expect(toCsv([{ a: 'say "hi", ok', b: "line1\nline2" }])).toBe('a,b\r\n"say ""hi"", ok","line1\nline2"\r\n');
  });
  it("neutralises spreadsheet formulas typed by participants", () => {
    expect(toCsv([{ a: "=HYPERLINK(1)" }], ["a"])).toBe("a\r\n'=HYPERLINK(1)\r\n");
  });
  it("keeps column order and blanks missing values", () => {
    expect(toCsv([{ b: 2 }], ["a", "b"])).toBe("a,b\r\n,2\r\n");
  });
});
