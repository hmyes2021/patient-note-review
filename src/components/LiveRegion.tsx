import { useEffect, useState } from "react";

/** One polite live region for the whole app, shown as a small toast above the footer. */
export function LiveRegion() {
  const [msg, setMsg] = useState("");
  useEffect(() => {
    let timer: number | undefined;
    const on = (e: Event) => {
      setMsg("");
      // Clearing first makes screen readers repeat identical messages.
      window.setTimeout(() => setMsg((e as CustomEvent<string>).detail), 30);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setMsg(""), 3000);
    };
    window.addEventListener("nr:announce", on);
    return () => { window.removeEventListener("nr:announce", on); window.clearTimeout(timer); };
  }, []);
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 z-40 flex justify-center px-4 ${msg ? "" : "sr-only"}`}
      style={{ bottom: "calc(var(--footer-h, 0px) + 1rem)" }}
    >
      {msg && <p className="rounded-xl bg-ink px-4 py-2 font-semibold text-white shadow-lg">{msg}</p>}
    </div>
  );
}
