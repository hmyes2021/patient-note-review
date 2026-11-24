import type { Sentence } from "../lib/content";
import type { Flag } from "../lib/types";
import { ChevronIcon } from "./Icons";
import { LessSureTag, StatusTag } from "./FlagBits";

interface Props {
  sentence: Sentence;
  flag?: Flag;
  showConfidence: boolean;
  onOpen: () => void;
}

/** Each sentence is one large button that opens "Check this sentence". */
export function NoteSentence({ sentence, flag, showConfidence, onOpen }: Props) {
  const lessSure = showConfidence && sentence.confidence === "low";
  return (
    <li>
      <button
        type="button"
        aria-haspopup="dialog"
        data-sentence={sentence.id}
        onClick={onOpen}
        className="group flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left hover:bg-sunken"
      >
        <span className="min-w-0 flex-1">
          <span className={lessSure ? "less-sure-text" : undefined}>{sentence.text}</span>
          {(lessSure || flag) && (
            <span className="mt-2 flex flex-wrap gap-2">
              {lessSure && <LessSureTag />}
              {flag && <StatusTag kind={flag.kind} />}
            </span>
          )}
        </span>
        <span className="mt-1 shrink-0 text-muted group-hover:text-accent">
          <ChevronIcon />
          <span className="sr-only">Check this sentence</span>
        </span>
      </button>
    </li>
  );
}
