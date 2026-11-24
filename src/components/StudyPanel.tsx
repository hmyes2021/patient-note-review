import { useEffect, useState } from "react";
import { allSentences, answerKey, note, sentenceById } from "../lib/content";
import { downloadText, toCsv } from "../lib/csv";
import { openedSentences, scoreFlags, type ErrorResult } from "../lib/scoring";
import type { Condition, StudyState } from "../lib/types";
import { navigate } from "../state/router";
import { useStore } from "../state/store";
import { FlaskIcon } from "./Icons";
import { Sheet } from "./Sheet";

const EVENT_COLUMNS = ["time", "msSinceStart", "participant", "condition", "event", "target", "flag", "reason", "text", "detail"];
const RESULT_TEXT: Record<ErrorResult, string> = { found: "✓ Found", noticed: "? Noticed (unclear)", missed: "✗ Missed" };

const seconds = (s: StudyState, now: number) => {
  if (!s.taskStartedAt) return null;
  const end = s.taskEndedAt ? new Date(s.taskEndedAt).getTime() : now;
  return Math.round((end - new Date(s.taskStartedAt).getTime()) / 1000);
};
const clock = (sec: number | null) => (sec === null ? "–" : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`);
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");

/** Researcher panel, available only with ?study=1. Everything stays in this browser. */
export function StudyPanel() {
  const [open, setOpen] = useState(false);
  const store = useStore();
  const { study, review, updateStudy, startTask, endTask, resetSession, log } = store;
  const [now, setNow] = useState(Date.now());
  const [confirmReset, setConfirmReset] = useState(false);
  const running = Boolean(study.taskStartedAt && !study.taskEndedAt);

  useEffect(() => {
    if (!running) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [running]);

  const score = scoreFlags(review.flags);
  const opened = openedSentences(study.events);
  const flags = Object.values(review.flags);
  const count = (k: string) => flags.filter((f) => f.kind === k).length;
  const elapsed = seconds(study, now);

  const summaryRow = () => {
    const row: Record<string, unknown> = {
      participant: study.participantId,
      condition: study.condition,
      patient_switch_allowed: study.allowPatientToggle,
      task_started: study.taskStartedAt ?? "",
      task_ended: study.taskEndedAt ?? "",
      time_on_task_sec: seconds(study, Date.now()) ?? "",
      review_status: review.status,
      sentences_total: allSentences().length,
      sentences_opened_unique: opened.length,
      low_confidence_opened: opened.filter((id) => sentenceById(id)?.confidence === "low").length,
      answers_total: flags.length,
      answers_correct: count("correct"),
      answers_wrong: count("wrong"),
      answers_missing: count("missing"),
      answers_unclear: count("unclear"),
      errors_found: score.found,
      errors_noticed: score.noticed,
      errors_missed: score.missed,
    };
    for (const e of score.errors) {
      row[`${e.id}_${e.type}_result`] = e.result;
      row[`${e.id}_${e.type}_answer`] = e.participantFlag;
    }
    row.false_alarms = score.falseAlarms.join(" ");
    row.low_conf_correct_marked_wrong = score.lowConfidenceCorrectFlagged.join(" ");
    row.low_conf_correct_confirmed = score.lowConfidenceCorrectConfirmed.join(" ");
    row.message_chars = review.message.trim().length;
    row.exported_at = new Date().toISOString();
    return row;
  };

  const exportEvents = () => {
    downloadText(`note-review_${study.participantId}_events_${stamp()}.csv`, toCsv(study.events as unknown as Record<string, unknown>[], EVENT_COLUMNS));
  };
  const exportSummary = () => downloadText(`note-review_${study.participantId}_summary_${stamp()}.csv`, toCsv([summaryRow()]));
  const exportAnswers = () => {
    const rows = note.sections.flatMap((section) => [
      ...section.sentences.map((s) => {
        const f = review.flags[`sentence:${s.id}`];
        const err = answerKey.errors.find((e) => e.target.sentenceId === s.id);
        return {
          participant: study.participantId, condition: study.condition, section: section.id, target: s.id,
          ai_confidence: s.confidence, seeded_error: err ? `${err.id} ${err.type}` : "", answer: f?.kind ?? "",
          reason: f?.reason ?? "", text: f?.text ?? "", sentence: s.text,
        };
      }),
      ...(review.flags[`section:${section.id}`]
        ? [(() => {
            const f = review.flags[`section:${section.id}`];
            return { participant: study.participantId, condition: study.condition, section: section.id, target: `section:${section.id}`,
              ai_confidence: "", seeded_error: "", answer: f.kind, reason: f.reason ?? "", text: f.text ?? "", sentence: "" };
          })()]
        : []),
    ]);
    downloadText(`note-review_${study.participantId}_answers_${stamp()}.csv`, toCsv(rows));
  };

  return (
    <>
      <button type="button" className="btn btn-secondary !min-h-11 border-dashed !px-3 !text-base" aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <FlaskIcon /> Researcher{running && <span className="font-mono">· {clock(elapsed)}</span>}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Researcher panel" titleId="study-title" variant="drawer">
        <div className="space-y-6 text-base">
          <p className="rounded-lg bg-sunken p-3">Study mode. Data is saved only in this browser until you export it. Keep this panel closed while the participant works.</p>

          <section aria-labelledby="setup-h" className="space-y-3">
            <h3 id="setup-h" className="text-lg font-bold">Session setup</h3>
            <div>
              <label htmlFor="pid" className="block font-semibold">Participant ID</label>
              <input id="pid" value={study.participantId} onChange={(e) => updateStudy({ participantId: e.target.value.replace(/[^\w-]/g, "").slice(0, 24) })}
                className="mt-1 w-full rounded-lg border-2 border-line-strong px-3" />
            </div>
            <fieldset>
              <legend className="font-semibold">Condition</legend>
              <div className="mt-1 grid gap-2">
                {([["markers-on", "Confidence markers ON"], ["markers-off", "Confidence markers OFF"]] as [Condition, string][]).map(([v, label]) => (
                  <label key={v} className="choice !min-h-11 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:font-bold">
                    <input type="radio" name="condition" checked={study.condition === v}
                      onChange={() => { updateStudy({ condition: v }); log("condition_set", { detail: v }); }} className="h-5 w-5 accent-[var(--color-accent)]" />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-center gap-3">
              <input type="checkbox" checked={study.allowPatientToggle} onChange={(e) => updateStudy({ allowPatientToggle: e.target.checked })}
                className="h-5 w-5 accent-[var(--color-accent)]" />
              Let the participant use the “Show where the AI was less sure” switch
            </label>
          </section>

          <section aria-labelledby="task-h" className="space-y-3">
            <h3 id="task-h" className="text-lg font-bold">Timed task</h3>
            <p>
              Time on task: <strong className="font-mono text-xl">{clock(elapsed)}</strong>{" "}
              {running ? "(running)" : study.taskEndedAt ? "(stopped)" : "(not started)"}
            </p>
            <p className="text-muted">Starting clears the participant's answers and opens the message screen. The timer stops on its own when they send, skip, or choose “Remind me later.”</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-primary" onClick={() => { startTask(); navigate("welcome"); setOpen(false); }}>
                {study.taskStartedAt ? "Restart task" : "Start task"}
              </button>
              <button type="button" className="btn btn-secondary" disabled={!running} onClick={() => endTask("researcher stopped")}>Stop task</button>
            </div>
          </section>

          <section aria-labelledby="results-h" className="space-y-2">
            <h3 id="results-h" className="text-lg font-bold">Seeded errors: {score.found} of {score.errors.length} found</h3>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Seeded errors table">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">Seeded errors compared with the participant's answers</caption>
                <thead><tr className="border-b-2 border-line-strong"><th scope="col" className="py-1 pr-2">Error</th><th scope="col" className="py-1 pr-2">Where</th><th scope="col" className="py-1">Result</th></tr></thead>
                <tbody>
                  {score.errors.map((e) => (
                    <tr key={e.id} className="border-b border-line align-top">
                      <th scope="row" className="py-2 pr-2 font-semibold">{e.id} {e.label}{e.lowConfidence && <span className="block text-sm font-normal text-muted">AI marked less sure</span>}</th>
                      <td className="py-2 pr-2">{e.target}</td>
                      <td className="py-2"><strong>{RESULT_TEXT[e.result]}</strong><span className="block text-sm text-muted">{e.participantFlag}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="list-disc space-y-1 pl-5">
              <li>“Less sure” but correct, marked wrong: <strong>{score.lowConfidenceCorrectFlagged.join(", ") || "none"}</strong> (of {answerKey.lowConfidenceCorrect.map((c) => c.sentenceId).join(", ")})</li>
              <li>Other false alarms (correct sentences marked wrong): <strong>{score.falseAlarms.filter((id) => !score.lowConfidenceCorrectFlagged.includes(id)).join(", ") || "none"}</strong></li>
              <li>Sentences opened: <strong>{opened.length}</strong> of {allSentences().length}</li>
              <li>Answers: {flags.length} (correct {count("correct")}, wrong {count("wrong")}, missing {count("missing")}, unclear {count("unclear")}) · Status: {review.status}</li>
            </ul>
          </section>

          <section aria-labelledby="export-h" className="space-y-2">
            <h3 id="export-h" className="text-lg font-bold">Export (CSV)</h3>
            <div className="grid gap-2">
              <button type="button" className="btn btn-secondary" onClick={exportEvents}>Event log ({study.events.length} events)</button>
              <button type="button" className="btn btn-secondary" onClick={exportSummary}>Session summary (1 row)</button>
              <button type="button" className="btn btn-secondary" onClick={exportAnswers}>Final answers (1 row per sentence)</button>
            </div>
          </section>

          <section aria-labelledby="nav-h" className="space-y-2">
            <h3 id="nav-h" className="text-lg font-bold">Go to</h3>
            <div className="flex flex-wrap gap-2">
              {([["welcome", "Messages"], ["review", "Note"], ["summary", "Summary"], ["clinician", "Clinician view"]] as const).map(([r, label]) => (
                <button key={r} type="button" className="btn btn-quiet" onClick={() => { navigate(r); setOpen(false); }}>{label}</button>
              ))}
            </div>
          </section>

          <section aria-labelledby="reset-h" className="space-y-2">
            <h3 id="reset-h" className="text-lg font-bold">Reset</h3>
            <p className="text-muted">Clears answers, clinician decisions, the timer and the event log. Export first.</p>
            {confirmReset ? (
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-primary" onClick={() => { resetSession(); setConfirmReset(false); navigate("welcome"); }}>Yes, clear everything</button>
                <button type="button" className="btn btn-quiet" onClick={() => setConfirmReset(false)}>Cancel</button>
              </div>
            ) : (
              <button type="button" className="btn btn-secondary" onClick={() => setConfirmReset(true)}>Reset session</button>
            )}
          </section>

          <section aria-labelledby="log-h">
            <h3 id="log-h" className="text-lg font-bold">Latest events</h3>
            <ol className="mt-2 space-y-1 font-mono text-sm">
              {study.events.slice(-12).reverse().map((e, i) => (
                <li key={`${e.time}-${i}`} className="break-words">
                  {e.msSinceStart !== null ? `${(e.msSinceStart / 1000).toFixed(1)}s` : e.time.slice(11, 19)} {e.event}
                  {e.target ? ` ${e.target}` : ""}{e.flag ? ` ${e.flag}` : ""}{e.detail ? ` (${e.detail})` : ""}
                </li>
              ))}
              {study.events.length === 0 && <li>No events yet.</li>}
            </ol>
          </section>
        </div>
      </Sheet>
    </>
  );
}
