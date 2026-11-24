import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { usePersistentState } from "./storage";
import { isStudyMode } from "./router";
import { allSentences, note, type FlagKind } from "../lib/content";
import {
  flagKey,
  type ClinicianState,
  type Decision,
  type Flag,
  type LogEvent,
  type ReviewState,
  type ReviewStatus,
  type StudyState,
} from "../lib/types";

const KEYS = { review: "nr.review.v1", clinician: "nr.clinician.v1", study: "nr.study.v1" };

const emptyReview: ReviewState = { status: "not-started", flags: {}, message: "", showConfidence: true };
const emptyClinician: ClinicianState = { decisions: {} };
const emptyStudy: StudyState = { participantId: "P01", condition: "markers-on", allowPatientToggle: false, events: [] };

type LogFields = Omit<LogEvent, "time" | "msSinceStart" | "participant" | "condition" | "event">;

interface Store {
  review: ReviewState;
  clinician: ClinicianState;
  study: StudyState;
  studyMode: boolean;
  /** Whether "AI was less sure" markers are shown right now. */
  confidenceVisible: boolean;
  /** Whether the patient-facing confidence switch is shown. */
  confidenceSwitchVisible: boolean;
  setFlag: (targetType: Flag["targetType"], id: string, kind: FlagKind) => void;
  updateFlag: (key: string, patch: Partial<Pick<Flag, "reason" | "text">>) => void;
  removeFlag: (key: string, source: string) => void;
  setMessage: (message: string) => void;
  setStatus: (status: ReviewStatus) => void;
  setShowConfidence: (on: boolean) => void;
  send: () => void;
  decide: (key: string, d: Omit<Decision, "at">) => void;
  undoDecision: (key: string) => void;
  signNote: () => void;
  loadExample: () => void;
  log: (event: string, fields?: LogFields) => void;
  updateStudy: (patch: Partial<Omit<StudyState, "events">>) => void;
  startTask: () => void;
  endTask: (why: string) => void;
  resetSession: (keepEvents?: boolean) => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const studyMode = useMemo(isStudyMode, []);
  const [review, setReview] = usePersistentState(KEYS.review, emptyReview);
  const [clinician, setClinician] = usePersistentState(KEYS.clinician, emptyClinician);
  const [study, setStudy] = usePersistentState(KEYS.study, emptyStudy);

  // Events are recorded only in study mode, and only in this browser.
  const log = useCallback(
    (event: string, fields: LogFields = {}) => {
      if (!studyMode) return;
      setStudy((s) => {
        const now = new Date();
        const running = s.taskStartedAt && !s.taskEndedAt;
        const entry: LogEvent = {
          time: now.toISOString(),
          msSinceStart: running ? now.getTime() - new Date(s.taskStartedAt!).getTime() : null,
          participant: s.participantId,
          condition: s.condition,
          event,
          ...fields,
        };
        return { ...s, events: [...s.events, entry] };
      });
    },
    [studyMode, setStudy],
  );

  const touch = (r: ReviewState): ReviewState =>
    r.status === "not-started" || r.status === "later" || r.status === "skipped" ? { ...r, status: "in-progress" } : r;

  const setFlag: Store["setFlag"] = (targetType, id, kind) => {
    const key = flagKey(targetType, id);
    setReview((r) => {
      const prev = r.flags[key];
      // Keep typed words if the patient switches between "wrong" and "missing".
      const keep = prev && prev.kind !== "correct" && kind !== "correct";
      const flag: Flag = {
        key, targetType, targetId: id, kind,
        reason: keep && prev.kind === kind ? prev.reason : undefined,
        text: keep ? prev.text : undefined,
        updatedAt: new Date().toISOString(),
      };
      return touch({ ...r, flags: { ...r.flags, [key]: flag } });
    });
    log("flag_set", { target: id, flag: kind });
  };

  const updateFlag: Store["updateFlag"] = (key, patch) =>
    setReview((r) =>
      r.flags[key] ? { ...r, flags: { ...r.flags, [key]: { ...r.flags[key], ...patch, updatedAt: new Date().toISOString() } } } : r,
    );

  const removeFlag: Store["removeFlag"] = (key, source) => {
    setReview((r) => {
      const flags = { ...r.flags };
      delete flags[key];
      return { ...r, flags };
    });
    log("flag_removed", { target: key.split(":")[1], detail: source });
  };

  const endTask = useCallback(
    (why: string) => {
      if (!studyMode) return;
      log("task_ended", { detail: why });
      setStudy((s) => (s.taskStartedAt && !s.taskEndedAt ? { ...s, taskEndedAt: new Date().toISOString() } : s));
    },
    [studyMode, log, setStudy],
  );

  const setStatus: Store["setStatus"] = (status) => {
    setReview((r) => ({ ...r, status }));
    if (status === "later") { log("remind_later"); endTask("remind later"); }
    if (status === "skipped") { log("review_skipped"); endTask("skipped"); }
  };

  const send = () => {
    setReview((r) => ({ ...r, status: "sent", sentAt: new Date().toISOString() }));
    setClinician(emptyClinician);
    log("sent", { detail: `${Object.keys(review.flags).length} answers, message ${review.message.trim().length} chars` });
    endTask("sent");
  };

  const decide: Store["decide"] = (key, d) => {
    setClinician((c) => ({ ...c, decisions: { ...c.decisions, [key]: { ...d, at: new Date().toISOString() } } }));
    log("clinician_decision", { target: key.split(":")[1], flag: d.decision, reason: d.reason, text: d.finalText });
  };
  const undoDecision: Store["undoDecision"] = (key) =>
    setClinician((c) => {
      const decisions = { ...c.decisions };
      delete decisions[key];
      return { ...c, decisions, signedAt: undefined };
    });

  const loadExample = () => {
    const at = new Date().toISOString();
    const f = (targetType: Flag["targetType"], targetId: string, kind: FlagKind, reason?: string, text?: string): Flag => ({
      key: flagKey(targetType, targetId), targetType, targetId, kind, reason, text, updatedAt: at,
    });
    const flags = [
      f("sentence", "s1", "correct"),
      f("sentence", "s3", "wrong", "Not how I described it", "It's a sharp, stabbing pain. About 6 most days and 8 on bad days."),
      f("sentence", "s4", "wrong", "Wrong side of the body", "It's my left leg."),
      f("sentence", "s7", "wrong", "I didn't say this", "The doctor suggested this. I haven't tried it yet."),
      f("section", "told", "missing", "A symptom", "My left foot and toes have been tingling for about 2 weeks."),
      f("sentence", "s13", "unclear", undefined, "I don't remember having an MRI."),
      f("sentence", "s15", "wrong", "Wrong number or amount", "Only the bedtime pill is 600. Morning and afternoon are still 300."),
      f("sentence", "s22", "correct"),
    ];
    setReview({
      ...emptyReview,
      status: "sent",
      sentAt: at,
      message: "Thank you! Will the new dose make me sleepy at work?",
      flags: Object.fromEntries(flags.map((x) => [x.key, x])),
    });
    setClinician(emptyClinician);
  };

  const resetSession: Store["resetSession"] = (keepEvents = false) => {
    setReview(emptyReview);
    setClinician(emptyClinician);
    setStudy((s) => ({ ...s, taskStartedAt: undefined, taskEndedAt: undefined, events: keepEvents ? s.events : [] }));
  };

  const startTask = () => {
    setReview({ ...emptyReview, showConfidence: study.condition === "markers-on" });
    setClinician(emptyClinician);
    setStudy((s) => ({ ...s, taskStartedAt: new Date().toISOString(), taskEndedAt: undefined }));
    // Logged after the start time is set so the first event reads 0 ms.
    setTimeout(() => log("task_started", { detail: `sentences: ${allSentences().length}, sections: ${note.sections.length}` }), 0);
  };

  const confidenceSwitchVisible = !studyMode || study.allowPatientToggle;
  const confidenceVisible =
    studyMode && !study.allowPatientToggle ? study.condition === "markers-on" : review.showConfidence;

  const value: Store = {
    review, clinician, study, studyMode, confidenceVisible, confidenceSwitchVisible,
    setFlag, updateFlag, removeFlag,
    setMessage: (message) => setReview((r) => ({ ...r, message })),
    setStatus,
    setShowConfidence: (on) => {
      setReview((r) => ({ ...r, showConfidence: on }));
      log("confidence_switch", { detail: on ? "on" : "off" });
    },
    send, decide, undoDecision,
    signNote: () => { setClinician((c) => ({ ...c, signedAt: new Date().toISOString() })); log("clinician_signed"); },
    loadExample, log,
    updateStudy: (patch) => {
      setStudy((s) => ({ ...s, ...patch }));
      // When the researcher sets a condition, the patient switch starts in that position.
      if (patch.condition) setReview((r) => ({ ...r, showConfidence: patch.condition === "markers-on" }));
    },
    startTask, endTask, resetSession,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const s = useContext(Ctx);
  if (!s) throw new Error("useStore must be used inside StoreProvider");
  return s;
}
