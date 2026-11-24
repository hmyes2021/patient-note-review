import { useEffect, useRef } from "react";
import { scenario, transcript, type Turn } from "../lib/content";

type Audience = "patient" | "clinician";

export const speakerLabel = (turn: Turn, audience: Audience) =>
  turn.speaker === "clinician"
    ? scenario.clinician.name
    : audience === "patient" ? `You (${scenario.patient.firstName})` : `Patient (${scenario.patient.name})`;

export function TurnList({ turns, audience, highlight = [] }: { turns: Turn[]; audience: Audience; highlight?: string[] }) {
  return (
    <ol className="space-y-2">
      {turns.map((t) => {
        const on = highlight.includes(t.id);
        return (
          <li key={t.id} data-turn={t.id} className={`rounded-lg px-3 py-2 ${on ? "turn-highlight" : "bg-sunken"}`}>
            <p className="text-base font-bold">
              {speakerLabel(t, audience)}
              {on && <span className="sr-only"> (linked to this sentence)</span>}
            </p>
            <p>{t.text}</p>
          </li>
        );
      })}
    </ol>
  );
}

/** The whole visit conversation with the linked turns highlighted; scrolls the first one into view. */
export function FullTranscript({ audience, highlight }: { audience: Audience; highlight: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!highlight[0]) return;
    ref.current?.querySelector(`[data-turn="${highlight[0]}"]`)?.scrollIntoView({ block: "nearest" });
  }, [highlight]);
  return (
    <div ref={ref} className="mt-3 max-h-[28rem] overflow-y-auto rounded-xl border border-line p-2" tabIndex={0}
      role="region" aria-label="Whole visit conversation">
      <TurnList turns={transcript.turns} audience={audience} highlight={highlight} />
    </div>
  );
}
