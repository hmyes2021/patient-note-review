import { lazy, Suspense, useEffect, useRef } from "react";
import { validateContent } from "./lib/content";
import { useRoute, type Route } from "./state/router";
import { useStore } from "./state/store";
import { PortalHeader, PrototypeFooter } from "./components/Layout";
import { LiveRegion } from "./components/LiveRegion";
import { Welcome } from "./screens/Welcome";
import { DoneForNow } from "./screens/DoneForNow";
import { Review } from "./screens/Review";
import { Summary } from "./screens/Summary";
import { Sent } from "./screens/Sent";

// Researcher-only and clinician code loads only when it is opened.
const ClinicianView = lazy(() => import("./screens/ClinicianView").then((m) => ({ default: m.ClinicianView })));
const StudyPanel = lazy(() => import("./components/StudyPanel").then((m) => ({ default: m.StudyPanel })));

const TITLES: Record<Route, string> = {
  welcome: "Messages",
  review: "Your visit note",
  summary: "Check your notes before sending",
  sent: "Sent",
  later: "Finish later",
  skipped: "Review skipped",
  clinician: "Patient corrections (clinician)",
};

const problems = validateContent();

export default function App() {
  const route = useRoute();
  const { studyMode, log } = useStore();
  const first = useRef(true);

  // On each screen change: update the tab title, move focus to the page heading, log the view.
  useEffect(() => {
    document.title = `${TITLES[route]} · Visit note review`;
    log("screen_viewed", { detail: route });
    if (first.current) { first.current = false; return; }
    window.scrollTo(0, 0);
    requestAnimationFrame(() => document.getElementById("page-title")?.focus());
  }, [route]); // eslint-disable-line react-hooks/exhaustive-deps

  if (problems.length) {
    return (
      <main className="mx-auto max-w-2xl p-6">
        <h1 className="text-2xl font-bold">The scenario files need a fix</h1>
        <ul className="mt-4 list-disc pl-6">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
      </main>
    );
  }

  const study = studyMode ? <Suspense fallback={null}><StudyPanel /></Suspense> : null;

  return (
    <>
      <a href="#main" onClick={(e) => { e.preventDefault(); document.getElementById("page-title")?.focus(); }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-3">
        Skip to main content
      </a>
      <PortalHeader audience={route === "clinician" ? "clinician" : "patient"} actions={study} />
      <main id="main" className={`mx-auto px-4 pt-6 ${route === "clinician" ? "max-w-4xl" : "max-w-2xl"}`}>
        {route === "welcome" && <Welcome />}
        {route === "review" && <Review />}
        {route === "summary" && <Summary />}
        {route === "sent" && <Sent />}
        {(route === "later" || route === "skipped") && <DoneForNow kind={route} />}
        {route === "clinician" && <Suspense fallback={<p>Loading…</p>}><ClinicianView /></Suspense>}
      </main>
      <PrototypeFooter />
      <LiveRegion />
    </>
  );
}
