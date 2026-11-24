import type { ReactNode } from "react";
import { scenario } from "../lib/content";
import { navigate } from "../state/router";
import { useStore } from "../state/store";

export function PortalHeader({ actions, audience = "patient" }: { actions?: ReactNode; audience?: "patient" | "clinician" }) {
  return (
    <header className="border-b border-line bg-surface">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-2 px-4 py-2">
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 font-bold text-accent">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="currentColor" /><path d="M9 20c3-7 11-7 14 0M12 13a4 4 0 1 0 8 0 4 4 0 0 0-8 0" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" /></svg>
          {scenario.portalName}{audience === "clinician" && <span className="font-semibold text-muted"> · Clinician</span>}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {audience === "patient" && <p className="text-base text-muted">{scenario.patient.name}</p>}
          {actions}
        </div>
      </div>
    </header>
  );
}

export function PrototypeFooter() {
  const { studyMode, resetSession } = useStore();
  return (
    <footer className="mx-auto max-w-2xl px-4 pb-8 pt-10 text-base text-muted">
      <p>{scenario.prototypeNotice} Nothing you enter leaves this device.</p>
      {!studyMode && (
        <nav aria-label="Prototype" className="mt-2 flex flex-wrap gap-x-2">
          <a className="btn btn-quiet !min-h-11 !px-1 !font-medium" href="#/clinician">Clinician view (demo)</a>
          <button type="button" className="btn btn-quiet !min-h-11 !px-1 !font-medium"
            onClick={() => { resetSession(); navigate("welcome"); }}>
            Start over
          </button>
          <a className="btn btn-quiet !min-h-11 !px-1 !font-medium" href="?study=1#/">Study mode</a>
        </nav>
      )}
    </footer>
  );
}
