import type { FlagKind } from "../lib/content";
import { ui } from "../lib/content";
import { CheckIcon, PlusIcon, QuestionIcon, UnsureIcon, WrongIcon } from "./Icons";

export const FLAG_ORDER: FlagKind[] = ["correct", "wrong", "missing", "unclear"];

export const FlagIcon = ({ kind }: { kind: FlagKind }) =>
  kind === "correct" ? <CheckIcon /> : kind === "wrong" ? <WrongIcon /> : kind === "missing" ? <PlusIcon /> : <QuestionIcon />;

export function LessSureTag() {
  return (
    <span className="less-sure-tag">
      <UnsureIcon />
      {ui.review.lessSure}
    </span>
  );
}

export function StatusTag({ kind }: { kind: FlagKind }) {
  return (
    <span className="status-tag">
      <FlagIcon kind={kind} />
      {ui.flags[kind].status}
    </span>
  );
}
