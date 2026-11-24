import { fill, ui } from "../lib/content";
import { CheckIcon } from "../components/Icons";

export function Sent() {
  return (
    <div className="card p-5 sm:p-6">
      <p className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-3xl text-accent"><CheckIcon /></p>
      <h1 id="page-title" tabIndex={-1} className="text-3xl font-bold">{ui.sent.title}</h1>
      <p className="mt-3">{fill(ui.sent.body)}</p>
      <p className="mt-3 text-muted">{ui.sent.urgent}</p>
      <a href="#/" className="btn btn-primary mt-6 w-full sm:w-auto">{ui.sent.back}</a>
    </div>
  );
}
