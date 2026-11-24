import { useEffect, useRef, useState } from "react";
import {
  fill, sectionById, sentenceById, turnsByIds, ui, type FlagKind,
} from "../lib/content";
import { flagKey } from "../lib/types";
import { useStore } from "../state/store";
import { announce } from "./announce";
import { FLAG_ORDER, FlagIcon, LessSureTag } from "./FlagBits";
import { CheckIcon } from "./Icons";
import { Sheet } from "./Sheet";
import { FullTranscript, TurnList } from "./Transcript";

export type SheetTarget = { type: "sentence" | "section"; id: string } | null;

/** "Check this sentence" and "Add something missing" in one sheet. Answers save as soon as they are tapped. */
export function FlagSheet({ target, onClose, origin }: { target: SheetTarget; onClose: () => void; origin: string }) {
  return (
    <Sheet
      open={Boolean(target)}
      onClose={onClose}
      titleId="flag-sheet-title"
      title={target?.type === "section" ? ui.sheet.sectionTitle : ui.sheet.sentenceTitle}
      footer={<button type="button" className="btn btn-primary" onClick={onClose}>{ui.sheet.done}</button>}
    >
      {target && <FlagSheetBody key={`${target.type}:${target.id}`} target={target} close={onClose} origin={origin} />}
    </Sheet>
  );
}

function FlagSheetBody({ target, close, origin }: { target: NonNullable<SheetTarget>; close: () => void; origin: string }) {
  const { review, setFlag, updateFlag, removeFlag, confidenceVisible, log } = useStore();
  const key = flagKey(target.type, target.id);
  const flag = review.flags[key];
  const sentence = target.type === "sentence" ? sentenceById(target.id) : undefined;
  const section = target.type === "section" ? sectionById(target.id) : undefined;
  const sent = review.status === "sent";
  const [showAll, setShowAll] = useState(false);
  const startText = useRef(flag?.text ?? "");
  const textRef = useRef(flag?.text ?? "");

  // Log what the participant typed once, when the sheet closes.
  useEffect(() => {
    log(target.type === "sentence" ? "sentence_opened" : "section_missing_opened", { target: target.id, detail: origin });
    return () => {
      if (textRef.current !== startText.current)
        log("text_entered", { target: target.id, text: textRef.current, detail: `${textRef.current.length} chars` });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choose = (kind: FlagKind) => {
    setFlag(target.type, target.id, kind);
    if (kind === "correct") {
      announce(`Saved: ${ui.flags.correct.option}`);
      close();
    } else {
      announce(`Saved: ${ui.flags[kind].option}`);
    }
  };

  const kind: FlagKind | undefined = target.type === "section" ? "missing" : flag?.kind;
  const reasons = kind === "wrong" ? ui.quickReasons.wrong : kind === "missing" ? ui.quickReasons.missing : [];
  const textLabel =
    kind === "wrong" ? ui.sheet.textLabelWrong : kind === "missing" ? ui.sheet.textLabelMissing : ui.sheet.textLabelUnclear;

  const ensureSectionFlag = () => {
    if (target.type === "section" && !flag) setFlag("section", target.id, "missing");
  };
  const pickReason = (r: string) => {
    ensureSectionFlag();
    const next = flag?.reason === r ? undefined : r;
    updateFlag(key, { reason: next });
    log("reason_set", { target: target.id, reason: next ?? "(cleared)" });
  };
  const typeText = (text: string) => {
    ensureSectionFlag();
    textRef.current = text;
    updateFlag(key, { text });
  };

  const sources = sentence ? turnsByIds(sentence.sourceTurns) : [];
  const lessSure = Boolean(sentence && confidenceVisible && sentence.confidence === "low");

  return (
    <div className="space-y-5">
      {sentence && (
        <>
          <figure className="rounded-xl border-l-4 border-line-strong bg-sunken px-4 py-3">
            <figcaption className="text-base font-semibold text-muted">The note says</figcaption>
            <blockquote className={`mt-1 text-lg ${lessSure ? "less-sure-text" : ""}`}>{sentence.text}</blockquote>
            {lessSure && (
              <div className="mt-3 space-y-1">
                <LessSureTag />
                <p className="text-base text-muted">{ui.sheet.lessSureNote}</p>
              </div>
            )}
          </figure>

          <section aria-labelledby="source-h">
            <h3 id="source-h" className="text-lg font-bold">{ui.sheet.sourceHeading}</h3>
            <p className="mb-2 text-base text-muted">
              {sentence.sourceMatch === "closest" ? ui.sheet.sourceClosest : ui.sheet.sourceDirect}
            </p>
            <TurnList turns={sources} audience="patient" highlight={sentence.sourceTurns} />
            <TranscriptToggle
              showAll={showAll}
              onToggle={() => { setShowAll(!showAll); log("full_transcript_toggled", { target: target.id, detail: !showAll ? "open" : "closed" }); }}
            />
            {showAll && <FullTranscript audience="patient" highlight={sentence.sourceTurns} />}
          </section>
        </>
      )}

      {section && (
        <>
          <p className="text-lg">{fill(ui.sheet.sectionPrompt, { section: section.heading })}</p>
          <TranscriptToggle
            showAll={showAll}
            onToggle={() => { setShowAll(!showAll); log("full_transcript_toggled", { target: target.id, detail: !showAll ? "open" : "closed" }); }}
          />
          {showAll && <FullTranscript audience="patient" highlight={[]} />}
        </>
      )}

      {sent ? (
        <p className="rounded-xl bg-sunken p-3">You already sent your answers. Thank you.</p>
      ) : (
        <>
          {sentence && (
            <div role="group" aria-labelledby="question-h">
              <h3 id="question-h" className="mb-2 text-lg font-bold">{ui.sheet.question}</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {FLAG_ORDER.map((k) => (
                  <button key={k} type="button" className="choice" aria-pressed={flag?.kind === k} onClick={() => choose(k)}>
                    <FlagIcon kind={k} />
                    <span className="flex-1">{ui.flags[k].option}</span>
                    {flag?.kind === k && <CheckIcon />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {kind && kind !== "correct" && (
            <div className="space-y-4 rounded-xl border border-line p-4">
              {flag && sentence && (
                <p className="flex items-center gap-2 font-semibold text-accent-strong">
                  <CheckIcon /> {ui.sheet.saved}. The rest is optional.
                </p>
              )}
              {reasons.length > 0 && (
                <div role="group" aria-labelledby="reason-h">
                  <h3 id="reason-h" className="mb-2 font-bold">
                    {kind === "wrong" ? ui.sheet.reasonLabelWrong : ui.sheet.reasonLabelMissing}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {reasons.map((r) => (
                      <button key={r} type="button" className="chip" aria-pressed={flag?.reason === r} onClick={() => pickReason(r)}>
                        {flag?.reason === r && <CheckIcon />}
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <label htmlFor="flag-text" className="mb-1 block font-bold">{textLabel}</label>
                <textarea
                  id="flag-text"
                  defaultValue={flag?.text ?? ""}
                  onChange={(e) => typeText(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border-2 border-line-strong bg-surface p-3 focus-visible:border-accent"
                />
              </div>
            </div>
          )}

          {flag && (
            <button type="button" className="btn btn-quiet" onClick={() => { removeFlag(key, origin); announce("Answer cleared"); close(); }}>
              {ui.sheet.clear}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function TranscriptToggle({ showAll, onToggle }: { showAll: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="btn btn-quiet mt-2 !px-1" aria-expanded={showAll} onClick={onToggle}>
      {showAll ? ui.sheet.hideAll : ui.sheet.showAll}
    </button>
  );
}
