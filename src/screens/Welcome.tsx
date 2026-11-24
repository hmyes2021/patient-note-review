import { fill, scenario, ui } from "../lib/content";
import { navigate } from "../state/router";
import { useStore } from "../state/store";
import { ClockIcon, MailIcon } from "../components/Icons";

export function Welcome() {
  const { review, setStatus, log } = useStore();
  const started = review.status === "in-progress" || (review.status === "later" && Object.keys(review.flags).length > 0);
  const sent = review.status === "sent";

  const start = () => {
    if (review.status !== "sent") setStatus("in-progress");
    log("review_started", { detail: started ? "continue" : "new" });
    navigate("review");
  };

  return (
    <>
      <h1 id="page-title" tabIndex={-1} className="mb-4 text-3xl font-bold">{ui.welcome.inboxHeading}</h1>
      <article className="card p-5 sm:p-6" aria-labelledby="msg-subject">
        <p className="flex items-center gap-2 text-base text-muted">
          <MailIcon /> {fill(ui.welcome.from)} · {scenario.clinic}
        </p>
        <h2 id="msg-subject" className="mt-2 text-2xl font-bold">{ui.welcome.subject}</h2>
        <div className="mt-3 space-y-3">
          {ui.welcome.body.map((p) => <p key={p}>{fill(p)}</p>)}
          <p className="flex items-start gap-2 text-muted"><span className="mt-1"><ClockIcon /></span>{fill(ui.welcome.deadline)}</p>
        </div>

        {sent ? (
          <div className="mt-6 space-y-3">
            <p className="rounded-xl bg-accent-soft p-3 font-semibold text-accent-strong">{fill(ui.welcome.alreadySent)}</p>
            <button type="button" className="btn btn-secondary w-full" onClick={() => navigate("review")}>{ui.welcome.viewNote}</button>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            <button type="button" className="btn btn-primary w-full" onClick={start}>
              {started ? ui.welcome.continue : ui.welcome.start}
            </button>
            <button type="button" className="btn btn-secondary w-full" onClick={() => { setStatus("later"); navigate("later"); }}>
              {ui.welcome.later}
            </button>
            <button type="button" className="btn btn-secondary w-full" onClick={() => { setStatus("skipped"); navigate("skipped"); }}>
              {ui.welcome.skip}
            </button>
          </div>
        )}
      </article>
    </>
  );
}
