import { useEffect, useState } from "react";

export type Route = "welcome" | "review" | "summary" | "sent" | "later" | "skipped" | "clinician";
const ROUTES: Route[] = ["welcome", "review", "summary", "sent", "later", "skipped", "clinician"];

const parse = (): Route => {
  const name = window.location.hash.replace(/^#\/?/, "").split("?")[0];
  return (ROUTES as string[]).includes(name) ? (name as Route) : "welcome";
};

export function navigate(route: Route) {
  const hash = route === "welcome" ? "#/" : `#/${route}`;
  if (window.location.hash !== hash) window.location.hash = hash;
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

/** Study mode is opened with ?study=1 in the address (before the #). */
export const isStudyMode = () => new URLSearchParams(window.location.search).get("study") === "1";
