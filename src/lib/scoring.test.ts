import { describe, expect, it } from "vitest";
import { answerKey, note, validateContent } from "./content";
import { scoreFlags } from "./scoring";
import { flagKey, type Flag } from "./types";
import type { FlagKind } from "./content";

const f = (targetType: Flag["targetType"], id: string, kind: FlagKind, text?: string): Flag => ({
  key: flagKey(targetType, id), targetType, targetId: id, kind, text, updatedAt: "",
});
const flags = (...list: Flag[]) => Object.fromEntries(list.map((x) => [x.key, x]));
const result = (s: ReturnType<typeof scoreFlags>, id: string) => s.errors.find((e) => e.id === id)!.result;

describe("scenario content", () => {
  it("has no broken ids", () => expect(validateContent()).toEqual([]));
  it("seeds six errors, one of each type", () => {
    expect(answerKey.errors.map((e) => e.type).sort()).toEqual(
      ["hallucination", "misattribution", "omission", "softened", "wrong-dose", "wrong-side"],
    );
  });
  it("marks some errors and some correct sentences as low confidence", () => {
    const low = note.sections.flatMap((s) => s.sentences).filter((s) => s.confidence === "low").map((s) => s.id);
    expect(answerKey.lowConfidenceCorrect.every((c) => low.includes(c.sentenceId))).toBe(true);
    expect(answerKey.errors.some((e) => e.target.sentenceId && low.includes(e.target.sentenceId))).toBe(true);
    expect(answerKey.errors.some((e) => e.target.sentenceId && !low.includes(e.target.sentenceId))).toBe(true);
  });
  it("reports a broken turn reference", () => {
    const broken = structuredClone(note);
    broken.sections[0].sentences[0].sourceTurns = ["t999"];
    expect(validateContent(broken)[0]).toMatch(/t999/);
  });
});

describe("scoreFlags", () => {
  it("misses everything with no answers", () => {
    const s = scoreFlags({});
    expect([s.found, s.missed]).toEqual([0, 6]);
  });
  it("counts wrong or missing on the target sentence as found, unclear as noticed", () => {
    const s = scoreFlags(flags(f("sentence", "s4", "wrong"), f("sentence", "s3", "missing"), f("sentence", "s13", "unclear"), f("sentence", "s7", "correct")));
    expect(result(s, "E5")).toBe("found");
    expect(result(s, "E6")).toBe("found");
    expect(result(s, "E2")).toBe("noticed");
    expect(result(s, "E3")).toBe("missed");
  });
  it("finds the omission from a section note, a sentence in that section, or a keyword anywhere", () => {
    expect(result(scoreFlags(flags(f("section", "told", "missing"))), "E1")).toBe("found");
    expect(result(scoreFlags(flags(f("sentence", "s8", "missing"))), "E1")).toBe("found");
    expect(result(scoreFlags(flags(f("section", "plan", "missing", "My toes are Tingling"))), "E1")).toBe("found");
    expect(result(scoreFlags(flags(f("section", "plan", "missing", "Ask about sleep"))), "E1")).toBe("missed");
  });
  it("separates false alarms on 'less sure' correct sentences", () => {
    const s = scoreFlags(flags(f("sentence", "s9", "wrong"), f("sentence", "s17", "correct"), f("sentence", "s12", "wrong")));
    expect(s.lowConfidenceCorrectFlagged).toEqual(["s9"]);
    expect(s.lowConfidenceCorrectConfirmed).toEqual(["s17"]);
    expect(s.falseAlarms.sort()).toEqual(["s12", "s9"]);
  });
});
