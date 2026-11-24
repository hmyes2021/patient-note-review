import { fill, ui } from "../lib/content";
import { navigate } from "../state/router";

export function DoneForNow({ kind }: { kind: "later" | "skipped" }) {
  return (
    <div className="card p-5 sm:p-6">
      <h1 id="page-title" tabIndex={-1} className="text-3xl font-bold">
        {kind === "later" ? ui.doneForNow.laterTitle : ui.doneForNow.skipTitle}
      </h1>
      <p className="mt-3">{fill(kind === "later" ? ui.doneForNow.laterBody : ui.doneForNow.skipBody)}</p>
      <button type="button" className="btn btn-primary mt-6 w-full sm:w-auto" onClick={() => navigate("welcome")}>
        {ui.doneForNow.back}
      </button>
    </div>
  );
}
