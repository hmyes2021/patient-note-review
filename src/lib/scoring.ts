import { answerKey as defaultKey, note as defaultNote, type AnswerKey, type Note } from "./content";
import type { Flag, LogEvent } from "./types";

export type ErrorResult = "found" | "noticed" | "missed";

export interface ErrorScore {
  id: string;
  type: string;
  label: string;
  target: string;
  result: ErrorResult;
  participantFlag: string; // what the participant did on that target, in words
  lowConfidence: boolean | null; // did the AI mark the target sentence as less sure (null for omissions)
}

export interface Score {
  errors: ErrorScore[];
  found: number;
  noticed: number;
  missed: number;
  /** "wrong" or "missing" flags on sentences that are not seeded errors. */
  falseAlarms: string[];
  /** Low-confidence-but-correct sentences the participant marked wrong. */
  lowConfidenceCorrectFlagged: string[];
  /** Low-confidence-but-correct sentences the participant confirmed correct. */
  lowConfidenceCorrectConfirmed: string[];
}

const describe = (f?: Flag) =>
  f ? [f.kind, f.reason, f.text ? `"${f.text}"` : ""].filter(Boolean).join(" · ") : "no answer";

export function scoreFlags(flags: Record<string, Flag>, key: AnswerKey = defaultKey, n: Note = defaultNote): Score {
  const list = Object.values(flags);
  const sentenceFlag = (id: string) => flags[`sentence:${id}`];
  const sectionOf = (sentenceId: string) => n.sections.find((s) => s.sentences.some((x) => x.id === sentenceId))?.id;
  const confidenceOf = (sentenceId: string) =>
    n.sections.flatMap((s) => s.sentences).find((s) => s.id === sentenceId)?.confidence;
  const errorSentenceIds = new Set(key.errors.map((e) => e.target.sentenceId).filter(Boolean) as string[]);

  const errors: ErrorScore[] = key.errors.map((e) => {
    if (e.target.sentenceId) {
      const f = sentenceFlag(e.target.sentenceId);
      const result: ErrorResult = f && e.foundWhen.includes(f.kind) ? "found" : f?.kind === "unclear" ? "noticed" : "missed";
      return {
        id: e.id, type: e.type, label: e.label, target: e.target.sentenceId, result,
        participantFlag: describe(f), lowConfidence: confidenceOf(e.target.sentenceId) === "low",
      };
    }
    // Omission: a "missing" flag on the section or a sentence in it, or a matching "missing" note anywhere.
    const sectionId = e.target.sectionId!;
    const words = (e.keywords ?? []).map((w) => w.toLowerCase());
    const missingFlags = list.filter((f) => f.kind === "missing");
    const hit =
      missingFlags.find((f) =>
        f.targetType === "section" ? f.targetId === sectionId : sectionOf(f.targetId) === sectionId,
      ) ?? missingFlags.find((f) => words.some((w) => (f.text ?? "").toLowerCase().includes(w)));
    return {
      id: e.id, type: e.type, label: e.label, target: `section ${sectionId}`,
      result: hit ? "found" : "missed", participantFlag: hit ? `${hit.key} · ${describe(hit)}` : "no matching 'missing' note",
      lowConfidence: null,
    };
  });

  const falseAlarms = list
    .filter((f) => f.targetType === "sentence" && f.kind === "wrong" && !errorSentenceIds.has(f.targetId))
    .map((f) => f.targetId);
  const lowIds = key.lowConfidenceCorrect.map((c) => c.sentenceId);
  return {
    errors,
    found: errors.filter((e) => e.result === "found").length,
    noticed: errors.filter((e) => e.result === "noticed").length,
    missed: errors.filter((e) => e.result === "missed").length,
    falseAlarms,
    lowConfidenceCorrectFlagged: lowIds.filter((id) => sentenceFlag(id)?.kind === "wrong"),
    lowConfidenceCorrectConfirmed: lowIds.filter((id) => sentenceFlag(id)?.kind === "correct"),
  };
}

/** Unique sentences the participant opened, from the event log. */
export const openedSentences = (events: LogEvent[]) =>
  [...new Set(events.filter((e) => e.event === "sentence_opened" && e.target).map((e) => e.target!))];
