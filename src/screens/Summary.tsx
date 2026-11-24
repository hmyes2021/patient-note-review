import { useEffect, useState } from "react";
import { fill, note, sectionById, sentenceById, ui } from "../lib/content";
import type { Flag } from "../lib/types";
import { navigate } from "../state/router";
import { useStore } from "../state/store";
import { FlagSheet, type SheetTarget } from "../components/FlagSheet";
import { StatusTag } from "../components/FlagBits";
import { announce } from "../components/announce";
import { BackIcon } from "../components/Icons";

/** Note order: each section's sentences, then that section's "missing" note. */
const ORDER = note.sections.flatMap((s) => [...s.sentences.map((x) => `sentence:${x.id}`), `section:${s.id}`]);

export function Summary() {
  const { review, setMessage, removeFlag, send, log } = useStore();
  const [target, setTarget] = useState<SheetTarget>(null);
  useEffect(() => { log("summary_viewed", { detail: `${Object.keys(review.flags).length} answers` }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (review.status === "sent") {
    return (
      <div className="card p-5">
        <h1 id="page-title" tabIndex={-1} className="text-3xl font-bold">{ui.sent.title}</h1>
        <p className="mt-3">{fill(ui.welcome.alreadySent)}</p>
        <a href="#/" className="btn btn-primary mt-5">{ui.sent.back}</a>
      </div>
    );
  }

  const flags = ORDER.map((k) => review.flags[k]).filter((f): f is Flag => Boolean(f));
  const issues = flags.filter((f) => f.kind !== "correct");
  const confirmed = flags.filter((f) => f.kind === "correct");

  const remove = (f: Flag) => {
    removeFlag(f.key, "summary");
    announce(ui.summary.removed);
    document.getElementById("page-title")?.focus();
  };

  return (
    <>
      <a href="#/review" className="btn btn-quiet -ml-2 mb-2 !px-2"><BackIcon /> {ui.summary.back}</a>
      <h1 id="page-title" tabIndex={-1} className="text-3xl font-bold">{ui.summary.title}</h1>
      <p className="mt-2">{flags.length ? ui.summary.intro : ui.summary.none}</p>

      {issues.length > 0 && (
        <section aria-labelledby="issues-h" className="mt-6">
          <h2 id="issues-h" className="text-xl font-bold">{ui.summary.issues} ({issues.length})</h2>
          <ul className="mt-3 space-y-3">
            {issues.map((f) => (
              <li key={f.key} className="card p-4">
                <SummaryItem flag={f} />
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" aria-label={`${ui.summary.edit}: ${itemName(f)}`} className="btn btn-secondary" aria-haspopup="dialog"
                    onClick={() => setTarget({ type: f.targetType, id: f.targetId })}>
                    {ui.summary.edit}
                  </button>
                  <button type="button" aria-label={`${ui.summary.remove}: ${itemName(f)}`} className="btn btn-quiet" onClick={() => remove(f)}>
                    {ui.summary.remove}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {confirmed.length > 0 && (
        <section aria-labelledby="ok-h" className="mt-6">
          <h2 id="ok-h" className="text-xl font-bold">{ui.summary.confirmed} ({confirmed.length})</h2>
          <ul className="card mt-3 divide-y divide-line">
            {confirmed.map((f) => (
              <li key={f.key} className="px-4 py-3">
                <span className="block">{sentenceById(f.targetId)?.text}</span>
                <span className="-ml-2 mt-1 flex gap-1">
                  <button type="button" aria-label={`${ui.summary.edit}: ${itemName(f)}`} className="btn btn-quiet !px-2" aria-haspopup="dialog" onClick={() => setTarget({ type: "sentence", id: f.targetId })}>
                    {ui.summary.edit}
                  </button>
                  <button type="button" aria-label={`${ui.summary.remove}: ${itemName(f)}`} className="btn btn-quiet !px-2" onClick={() => remove(f)}>
                    {ui.summary.remove}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="send-h" className="card mt-6 p-4 sm:p-5">
        <h2 id="send-h" className="sr-only">Send</h2>
        <label htmlFor="message" className="block font-bold">{fill(ui.summary.messageLabel)}</label>
        <p id="message-hint" className="text-base text-muted">{ui.summary.messageHint}</p>
        <textarea
          id="message"
          aria-describedby="message-hint"
          value={review.message}
          onChange={(e) => setMessage(e.target.value)}
          onBlur={() => review.message && log("message_entered", { text: review.message, detail: `${review.message.length} chars` })}
          rows={3}
          className="mt-2 w-full rounded-xl border-2 border-line-strong bg-surface p-3 focus-visible:border-accent"
        />
        <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
          <button type="button" className="btn btn-primary" onClick={() => { send(); navigate("sent"); }}>
            {flags.length ? fill(ui.summary.send) : ui.summary.sendNone}
          </button>
          <a href="#/review" className="btn btn-secondary">{ui.summary.back}</a>
        </div>
      </section>

      <FlagSheet target={target} onClose={() => setTarget(null)} origin="summary" />
    </>
  );
}

const itemName = (f: Flag) =>
  f.targetType === "section" ? `missing from ${sectionById(f.targetId)?.heading}` : `“${sentenceById(f.targetId)?.text}”`;

function SummaryItem({ flag }: { flag: Flag }) {
  const sentence = flag.targetType === "sentence" ? sentenceById(flag.targetId) : undefined;
  return (
    <dl className="space-y-2">
      <div>
        <dt className="text-base font-semibold text-muted">{sentence ? ui.summary.original : ui.summary.section}</dt>
        <dd>{sentence ? `“${sentence.text}”` : sectionById(flag.targetId)?.heading}</dd>
      </div>
      <div>
        <dt className="sr-only">Your answer</dt>
        <dd><StatusTag kind={flag.kind} /></dd>
      </div>
      {flag.reason && (
        <div>
          <dt className="text-base font-semibold text-muted">{ui.summary.reason}</dt>
          <dd>{flag.reason}</dd>
        </div>
      )}
      {flag.text && (
        <div>
          <dt className="text-base font-semibold text-muted">{ui.summary.yourWords}</dt>
          <dd className="whitespace-pre-wrap">{flag.text}</dd>
        </div>
      )}
    </dl>
  );
}
