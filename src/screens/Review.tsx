import { useEffect, useRef, useState } from "react";
import { fill, note, scenario, ui } from "../lib/content";
import { flagKey } from "../lib/types";
import { navigate } from "../state/router";
import { useStore } from "../state/store";
import { FlagSheet, type SheetTarget } from "../components/FlagSheet";
import { NoteSentence } from "../components/NoteSentence";
import { LessSureTag, StatusTag } from "../components/FlagBits";
import { BackIcon, PlusIcon, SparkIcon } from "../components/Icons";

export function Review() {
  const { review, confidenceVisible, confidenceSwitchVisible, setShowConfidence, setStatus } = useStore();
  const [target, setTarget] = useState<SheetTarget>(null);
  const footer = useRef<HTMLDivElement>(null);
  const sent = review.status === "sent";
  const count = Object.keys(review.flags).length;

  // Tell the page how tall the sticky footer is, so focused items never hide behind it.
  useEffect(() => {
    const el = footer.current;
    if (!el) return;
    const set = () => {
      const sticky = getComputedStyle(el).position === "sticky";
      document.documentElement.style.setProperty("--footer-h", sticky ? `${el.offsetHeight + 16}px` : "0px");
    };
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    window.addEventListener("resize", set);
    return () => { ro.disconnect(); window.removeEventListener("resize", set); document.documentElement.style.removeProperty("--footer-h"); };
  }, []);

  return (
    <>
      <a href="#/" className="btn btn-quiet -ml-2 mb-2 !px-2"><BackIcon /> Messages</a>
      <h1 id="page-title" tabIndex={-1} className="text-3xl font-bold">{ui.review.title}</h1>
      <p className="mt-1 text-muted">
        {scenario.clinician.name} · {scenario.visitDate} · {scenario.clinic}
      </p>

      <section aria-labelledby="ai-label" className="card mt-5 border-2 border-accent p-4 sm:p-5">
        <h2 id="ai-label" className="flex items-center gap-2 text-lg font-bold text-accent-strong">
          <SparkIcon /> {fill(ui.review.aiLabel)}
        </h2>
        <p className="mt-2">{fill(ui.review.aiBody)} <strong>{ui.review.why}</strong></p>
        <p className="mt-2 text-muted">{ui.review.how}</p>

        {confidenceSwitchVisible && (
          <label className="mt-4 flex cursor-pointer items-center justify-between gap-4 rounded-xl bg-sunken px-4 py-3">
            <span className="font-semibold">{ui.review.confidenceSwitch}</span>
            <input
              type="checkbox"
              role="switch"
              checked={review.showConfidence}
              onChange={(e) => setShowConfidence(e.target.checked)}
              className="h-7 w-12 shrink-0 cursor-pointer accent-[var(--color-accent)]"
            />
          </label>
        )}
        {confidenceVisible && (
          <p className="mt-3 flex flex-wrap items-center gap-2 text-base text-muted">
            <LessSureTag /> <span><span className="less-sure-text">Dotted underline</span> and this tag: {ui.review.confidenceLegend}</span>
          </p>
        )}
      </section>

      {sent && (
        <p className="mt-5 rounded-xl bg-accent-soft p-4 font-semibold text-accent-strong">{fill(ui.welcome.alreadySent)}</p>
      )}

      <article aria-labelledby="note-title" className="card mt-5 px-2 py-4 sm:px-4">
        <h2 id="note-title" className="sr-only">{note.title}</h2>
        {note.sections.map((section) => {
          const missing = review.flags[flagKey("section", section.id)];
          return (
            <section key={section.id} aria-labelledby={`h-${section.id}`} className="border-b border-line pb-3 pt-2 last:border-b-0">
              <h3 id={`h-${section.id}`} className="px-3 pt-2 text-xl font-bold">{section.heading}</h3>
              <ul className="mt-1">
                {section.sentences.map((s) => (
                  <NoteSentence
                    key={s.id}
                    sentence={s}
                    flag={review.flags[flagKey("sentence", s.id)]}
                    showConfidence={confidenceVisible}
                    onOpen={() => setTarget({ type: "sentence", id: s.id })}
                  />
                ))}
              </ul>
              {!sent && (
                <div className="flex flex-wrap items-center gap-2 px-1">
                  <button type="button" aria-haspopup="dialog" className="btn btn-quiet !font-semibold"
                    aria-label={`${ui.review.missingButton} in ${section.heading}`}
                    onClick={() => setTarget({ type: "section", id: section.id })}>
                    <PlusIcon /> {ui.review.missingButton}
                  </button>
                  {missing && <StatusTag kind="missing" />}
                </div>
              )}
            </section>
          );
        })}
      </article>

      {!sent && (
        <div ref={footer} className="sticky bottom-0 z-30 -mx-4 mt-6 border-t border-line bg-surface/95 px-4 pb-3 pt-2 backdrop-blur [@media(max-height:32rem)]:static">
          <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-x-4 gap-y-1">
            <p className="w-full text-base font-semibold sm:w-auto sm:flex-1">
              {count === 0 ? ui.review.footerNone : fill(ui.review.footerCount, { count: count === 1 ? "1 thing" : `${count} things` })}
            </p>
            <div className="flex flex-1 flex-wrap gap-2 sm:flex-none">
              <button type="button" className="btn btn-secondary flex-none !px-4" onClick={() => { setStatus("later"); navigate("later"); }}>
                {ui.review.finishLater}
              </button>
              <button type="button" className="btn btn-primary flex-1 !px-4" onClick={() => navigate("summary")}>
                {ui.review.reviewAndSend}
              </button>
            </div>
          </div>
        </div>
      )}

      <FlagSheet target={target} onClose={() => setTarget(null)} origin="note" />
    </>
  );
}
