import { useState } from "react";
import { fill, note, scenario, sectionById, sentenceById, turnsByIds, ui } from "../lib/content";
import type { Decision, Flag } from "../lib/types";
import { useStore } from "../state/store";
import { announce } from "../components/announce";
import { FlagIcon } from "../components/FlagBits";
import { CheckIcon, UnsureIcon } from "../components/Icons";
import { FullTranscript, TurnList } from "../components/Transcript";

const KIND_LABEL: Record<string, string> = {
  wrong: "Patient says this is wrong",
  missing: "Patient says something is missing",
  unclear: "Patient did not understand this",
};
const ORDER = note.sections.flatMap((s) => [...s.sentences.map((x) => `sentence:${x.id}`), `section:${s.id}`]);
const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" }) : "";

/** What the clinician receives: each correction with the original, the patient's words and the transcript. */
export function ClinicianView() {
  const { review, clinician, loadExample, signNote } = useStore();
  const sent = review.status === "sent";
  const flags = ORDER.map((k) => review.flags[k]).filter((f): f is Flag => Boolean(f));
  const items = flags.filter((f) => f.kind !== "correct");
  const confirmed = flags.length - items.length;
  const pending = items.filter((f) => !clinician.decisions[f.key]).length;

  return (
    <>
      <h1 id="page-title" tabIndex={-1} className="text-3xl font-bold">{ui.clinician.title}</h1>
      <p className="mt-1 text-muted">
        {scenario.patient.name}, {scenario.patient.age} · Visit {scenario.visitDate} · {scenario.clinician.name}
        {sent && review.sentAt && <> · Sent {when(review.sentAt)}</>}
      </p>

      {!sent ? (
        <div className="card mt-6 p-5">
          <p>{ui.clinician.noneYet}</p>
          <button type="button" className="btn btn-secondary mt-4" onClick={() => { loadExample(); announce("Example corrections loaded"); }}>
            {ui.clinician.loadExample}
          </button>
        </div>
      ) : (
        <>
          <p className="mt-4">{ui.clinician.intro}</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <Stat label="Items to review" value={items.length} />
            <Stat label="Still pending" value={pending} />
            <Stat label="Confirmed correct" value={confirmed} />
          </div>

          {review.message.trim() && (
            <section aria-labelledby="msg-h" className="card mt-5 p-4">
              <h2 id="msg-h" className="font-bold">{ui.clinician.patientMessage}</h2>
              <p className="mt-1 whitespace-pre-wrap">“{review.message.trim()}”</p>
            </section>
          )}

          <h2 className="mt-8 text-2xl font-bold">Corrections ({items.length})</h2>
          {items.length === 0 && <p className="mt-2">The patient did not ask for any changes.</p>}
          <ol className="mt-3 space-y-4">
            {items.map((f, i) => <CorrectionCard key={f.key} flag={f} index={i + 1} />)}
          </ol>

          <UpdatedNote />

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button type="button" className="btn btn-primary" disabled={pending > 0 || Boolean(clinician.signedAt)}
              onClick={() => { signNote(); announce("Note signed"); }}>
              {ui.clinician.signed}
            </button>
            <p className="text-base text-muted">
              {clinician.signedAt ? `Signed ${when(clinician.signedAt)}.` : pending > 0 ? `Decide on ${pending} more item${pending === 1 ? "" : "s"} to sign.` : "Ready to sign."}
            </p>
          </div>
        </>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <p className="card flex flex-col px-4 py-3">
      <span className="text-3xl font-bold">{value}</span>
      <span className="text-base text-muted">{label}</span>
    </p>
  );
}

function CorrectionCard({ flag, index }: { flag: Flag; index: number }) {
  const { clinician, decide, undoDecision } = useStore();
  const decision = clinician.decisions[flag.key];
  const sentence = flag.targetType === "sentence" ? sentenceById(flag.targetId) : undefined;
  const section = flag.targetType === "section" ? sectionById(flag.targetId) : undefined;
  const [mode, setMode] = useState<"buttons" | "edit" | "decline">("buttons");
  const [showAll, setShowAll] = useState(false);
  const titleId = `corr-${flag.key.replace(":", "-")}`;

  return (
    <li className="card p-4 sm:p-5" aria-labelledby={titleId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id={titleId} className="flex items-center gap-2 text-lg font-bold">
          <span className="text-muted">{index}.</span> <FlagIcon kind={flag.kind} /> {KIND_LABEL[flag.kind]}
        </h3>
        {sentence?.confidence === "low" && (
          <span className="less-sure-tag"><UnsureIcon /> AI confidence: low</span>
        )}
      </div>

      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <h4 className="text-base font-semibold text-muted">{ui.clinician.original}</h4>
            <p className="mt-1 rounded-lg bg-sunken px-3 py-2">
              {sentence ? `“${sentence.text}”` : <>No sentence. Section: <strong>{section?.heading}</strong></>}
            </p>
          </div>
          <div>
            <h4 className="text-base font-semibold text-muted">{ui.clinician.patientSays}</h4>
            <div className="mt-1 rounded-lg border-l-4 border-accent bg-accent-soft px-3 py-2">
              {flag.reason && <p className="font-semibold">{flag.reason}</p>}
              {flag.text ? <p className="whitespace-pre-wrap">“{flag.text}”</p> : !flag.reason && <p className="italic">No details given.</p>}
            </div>
          </div>
        </div>
        <div>
          <h4 className="text-base font-semibold text-muted">{ui.clinician.transcript}</h4>
          {sentence ? (
            <>
              {sentence.sourceMatch === "closest" && (
                <p className="mt-1 text-base font-semibold">Closest match only: the scribe found no exact source for this sentence.</p>
              )}
              <div className="mt-1"><TurnList turns={turnsByIds(sentence.sourceTurns)} audience="clinician" highlight={sentence.sourceTurns} /></div>
            </>
          ) : (
            <p className="mt-1 text-base">No linked excerpt. Search the whole conversation.</p>
          )}
          <button type="button" className="btn btn-quiet mt-1 !px-1" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>
            {showAll ? "Hide full transcript" : "Show full transcript"}
          </button>
          {showAll && <FullTranscript audience="clinician" highlight={sentence?.sourceTurns ?? []} />}
        </div>
      </div>

      <div className="mt-4 border-t border-line pt-4">
        {decision ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <DecisionLine decision={decision} />
            <button type="button" className="btn btn-quiet" aria-label={`${ui.clinician.change} for item ${index}`} onClick={() => { undoDecision(flag.key); setMode("buttons"); }}>
              {ui.clinician.change}
            </button>
          </div>
        ) : mode === "edit" ? (
          <EditForm flag={flag} index={index} onCancel={() => setMode("buttons")}
            onSave={(finalText) => { decide(flag.key, { decision: "edited", finalText }); announce(`Item ${index} edited`); }} />
        ) : mode === "decline" ? (
          <DeclineForm index={index} onCancel={() => setMode("buttons")}
            onSave={(reason) => { decide(flag.key, { decision: "declined", reason }); announce(`Item ${index} declined`); }} />
        ) : (
          <div className="flex flex-wrap gap-2" role="group" aria-label={`Decision for item ${index}`}>
            <button type="button" className="btn btn-primary" onClick={() => { decide(flag.key, { decision: "accepted" }); announce(`Item ${index} accepted`); }}>
              <CheckIcon /> {ui.clinician.accept}
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => setMode("edit")}>{ui.clinician.edit}</button>
            <button type="button" className="btn btn-secondary" onClick={() => setMode("decline")}>{ui.clinician.decline}</button>
          </div>
        )}
      </div>
    </li>
  );
}

function DecisionLine({ decision }: { decision: Decision }) {
  const label = { accepted: "Accepted", edited: "Edited", declined: "Declined" }[decision.decision];
  return (
    <div className="flex-1" role="status">
      <p className="flex items-center gap-2 font-bold"><CheckIcon /> {label}</p>
      {decision.finalText && <p className="mt-1">New text: “{decision.finalText}”</p>}
      {decision.reason && <p className="mt-1">Reason: {decision.reason}</p>}
    </div>
  );
}

function EditForm({ flag, index, onSave, onCancel }: { flag: Flag; index: number; onSave: (t: string) => void; onCancel: () => void }) {
  const start = flag.targetType === "sentence" ? sentenceById(flag.targetId)?.text ?? "" : flag.text ?? "";
  const [text, setText] = useState(start);
  const [error, setError] = useState("");
  const id = `edit-${index}`;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!text.trim()) { setError("Enter the sentence for the note."); return; }
        onSave(text.trim());
      }}
    >
      <label htmlFor={id} className="block font-bold">{ui.clinician.editLabel}</label>
      <textarea id={id} value={text} onChange={(e) => setText(e.target.value)} rows={3} autoFocus
        aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-err` : undefined}
        className="mt-1 w-full rounded-xl border-2 border-line-strong bg-surface p-3" />
      {error && <p id={`${id}-err`} className="mt-1 font-semibold">⚠ {error}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary">{ui.clinician.saveEdit}</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>{ui.sheet.cancel}</button>
      </div>
    </form>
  );
}

function DeclineForm({ index, onSave, onCancel }: { index: number; onSave: (r: string) => void; onCancel: () => void }) {
  const [choice, setChoice] = useState("");
  const [other, setOther] = useState("");
  const [error, setError] = useState("");
  const isOther = choice === "Other";
  const name = `decline-${index}`;
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (!choice) { setError("Choose a reason for declining."); return; }
        if (isOther && !other.trim()) { setError("Write a short reason."); return; }
        onSave(isOther ? other.trim() : choice);
      }}
    >
      <fieldset aria-describedby={error ? `${name}-err` : undefined}>
        <legend className="font-bold">{ui.clinician.declineReasonLabel}</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {ui.clinician.declineReasons.map((r) => (
            <label key={r} className="choice has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:font-bold">
              <input type="radio" name={name} value={r} checked={choice === r} required
                onChange={() => { setChoice(r); setError(""); }} className="h-5 w-5 accent-[var(--color-accent)]" />
              {r}
            </label>
          ))}
        </div>
      </fieldset>
      {isOther && (
        <div className="mt-3">
          <label htmlFor={`${name}-other`} className="block font-bold">{ui.clinician.declineOtherLabel}</label>
          <input id={`${name}-other`} value={other} onChange={(e) => { setOther(e.target.value); setError(""); }} maxLength={160}
            className="mt-1 w-full rounded-xl border-2 border-line-strong bg-surface px-3" />
        </div>
      )}
      {error && <p id={`${name}-err`} role="alert" className="mt-2 font-semibold">⚠ {error}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary">{ui.clinician.confirmDecline}</button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>{ui.sheet.cancel}</button>
      </div>
    </form>
  );
}

/** The note with decisions applied: accepted patient words, clinician edits, and added items. */
function UpdatedNote() {
  const { review, clinician } = useStore();
  const tag = (text: string) => <span className="status-tag ml-2 align-middle !text-sm">{text}</span>;
  return (
    <section aria-labelledby="updated-h" className="card mt-8 p-4 sm:p-5">
      <h2 id="updated-h" className="text-2xl font-bold">{ui.clinician.updatedNote}</h2>
      {note.sections.map((section) => {
        const missing = review.flags[`section:${section.id}`];
        const missingDecision = missing && clinician.decisions[missing.key];
        return (
          <section key={section.id} className="mt-4">
            <h3 className="text-lg font-bold">{section.heading}</h3>
            <ul className="mt-1 list-disc space-y-1 pl-6">
              {section.sentences.map((s) => {
                const f = review.flags[`sentence:${s.id}`];
                const d = f && clinician.decisions[f.key];
                if (f && f.kind !== "correct" && !d) return <li key={s.id}>{s.text}{tag("Pending")}</li>;
                if (d?.decision === "edited") return <li key={s.id}>{d.finalText}{tag("Edited")}</li>;
                if (d?.decision === "accepted" && f.kind === "unclear") return <li key={s.id}>{s.text}{tag("Explain to patient")}</li>;
                if (d?.decision === "accepted")
                  return <li key={s.id}>{s.text} <strong>Patient correction: {f.text || f.reason || "marked as wrong"}.</strong>{tag("Corrected")}</li>;
                return <li key={s.id}>{s.text}</li>;
              })}
              {missing && !missingDecision && <li>{missing.text || missing.reason}{tag("Pending addition")}</li>}
              {missingDecision?.decision === "accepted" && <li>Patient reports: {missing.text || missing.reason}.{tag("Added")}</li>}
              {missingDecision?.decision === "edited" && <li>{missingDecision.finalText}{tag("Added")}</li>}
            </ul>
          </section>
        );
      })}
      <p className="mt-4 text-base text-muted">{fill("Changes are kept in this browser only. {clinician} would sign the final note in the clinic system.")}</p>
    </section>
  );
}
