import scenarioJson from "../content/scenario.json";
import transcriptJson from "../content/transcript.json";
import noteJson from "../content/note.json";
import answerKeyJson from "../content/answer-key.json";
import uiTextJson from "../content/ui-text.json";

export type Speaker = "clinician" | "patient";
export interface Turn { id: string; speaker: Speaker; text: string }
export interface Transcript { speakers: Record<Speaker, string>; turns: Turn[] }

export type Confidence = "high" | "low";
export interface Sentence {
  id: string;
  text: string;
  sourceTurns: string[];
  sourceMatch: "direct" | "closest";
  confidence: Confidence;
}
export interface Section { id: string; heading: string; sentences: Sentence[] }
export interface Note { title: string; sections: Section[] }

export type FlagKind = "correct" | "wrong" | "missing" | "unclear";
export interface SeededError {
  id: string;
  type: string;
  label: string;
  target: { sentenceId?: string; sectionId?: string };
  foundWhen: FlagKind[];
  keywords?: string[];
  whatIsWrong: string;
  whatWasSaid: string;
  transcriptTurns: string[];
}
export interface AnswerKey {
  errors: SeededError[];
  lowConfidenceCorrect: { sentenceId: string; note: string }[];
}

export const scenario = scenarioJson;
export const transcript = transcriptJson as Transcript;
export const note = noteJson as Note;
export const answerKey = answerKeyJson as AnswerKey;
export const ui = uiTextJson;

/** Replaces {placeholders} with scenario values plus any extra values. */
export function fill(template: string, extra: Record<string, string | number> = {}): string {
  const values: Record<string, string | number> = {
    clinician: scenario.clinician.name,
    patient: scenario.patient.firstName,
    visitDate: scenario.visitDate,
    deadline: scenario.reviewDeadline,
    minutes: scenario.estimatedMinutes,
    ...extra,
  };
  return template.replace(/\{(\w+)\}/g, (m, key: string) => (key in values ? String(values[key]) : m));
}

export const allSentences = (n: Note = note) => n.sections.flatMap((s) => s.sentences);
export const sentenceById = (id: string) => allSentences().find((s) => s.id === id);
export const sectionById = (id: string) => note.sections.find((s) => s.id === id);
export const sectionOfSentence = (id: string) => note.sections.find((s) => s.sentences.some((x) => x.id === id));
export const turnsByIds = (ids: string[]) =>
  ids.map((id) => transcript.turns.find((t) => t.id === id)).filter((t): t is Turn => Boolean(t));

/** Checks that the editable JSON files fit together. Returns a list of plain-language problems. */
export function validateContent(n: Note = note, t: Transcript = transcript, k: AnswerKey = answerKey): string[] {
  const problems: string[] = [];
  const turnIds = new Set<string>();
  for (const turn of t.turns) {
    if (turnIds.has(turn.id)) problems.push(`transcript.json: turn id "${turn.id}" is used twice.`);
    turnIds.add(turn.id);
    if (turn.speaker !== "clinician" && turn.speaker !== "patient")
      problems.push(`transcript.json: turn "${turn.id}" has speaker "${turn.speaker}" (use "clinician" or "patient").`);
  }
  const sentenceIds = new Set<string>();
  const sectionIds = new Set<string>();
  for (const section of n.sections) {
    if (sectionIds.has(section.id)) problems.push(`note.json: section id "${section.id}" is used twice.`);
    sectionIds.add(section.id);
    for (const s of section.sentences) {
      if (sentenceIds.has(s.id)) problems.push(`note.json: sentence id "${s.id}" is used twice.`);
      sentenceIds.add(s.id);
      if (s.confidence !== "high" && s.confidence !== "low")
        problems.push(`note.json: sentence "${s.id}" confidence must be "high" or "low".`);
      if (s.sourceMatch !== "direct" && s.sourceMatch !== "closest")
        problems.push(`note.json: sentence "${s.id}" sourceMatch must be "direct" or "closest".`);
      for (const turn of s.sourceTurns)
        if (!turnIds.has(turn)) problems.push(`note.json: sentence "${s.id}" points to missing turn "${turn}".`);
    }
  }
  for (const e of k.errors) {
    const { sentenceId, sectionId } = e.target;
    if (!sentenceId && !sectionId) problems.push(`answer-key.json: error "${e.id}" needs a sentenceId or sectionId.`);
    if (sentenceId && !sentenceIds.has(sentenceId))
      problems.push(`answer-key.json: error "${e.id}" points to missing sentence "${sentenceId}".`);
    if (sectionId && !sectionIds.has(sectionId))
      problems.push(`answer-key.json: error "${e.id}" points to missing section "${sectionId}".`);
    for (const turn of e.transcriptTurns)
      if (!turnIds.has(turn)) problems.push(`answer-key.json: error "${e.id}" points to missing turn "${turn}".`);
  }
  for (const c of k.lowConfidenceCorrect)
    if (!sentenceIds.has(c.sentenceId))
      problems.push(`answer-key.json: lowConfidenceCorrect points to missing sentence "${c.sentenceId}".`);
  return problems;
}
