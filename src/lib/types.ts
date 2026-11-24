import type { FlagKind } from "./content";

/** One answer per sentence, plus one "something missing" note per section. */
export interface Flag {
  key: string; // "sentence:s3" or "section:told"
  targetType: "sentence" | "section";
  targetId: string;
  kind: FlagKind;
  reason?: string;
  text?: string;
  updatedAt: string;
}

export type ReviewStatus = "not-started" | "in-progress" | "later" | "skipped" | "sent";

export interface ReviewState {
  status: ReviewStatus;
  flags: Record<string, Flag>;
  message: string;
  sentAt?: string;
  /** Patient's own switch (used outside study mode, or when the researcher allows it). */
  showConfidence: boolean;
}

export type Decision = { decision: "accepted" | "edited" | "declined"; finalText?: string; reason?: string; at: string };
export type ClinicianState = { decisions: Record<string, Decision>; signedAt?: string };

export type Condition = "markers-on" | "markers-off";

export interface LogEvent {
  time: string; // ISO timestamp
  msSinceStart: number | null; // since the researcher started the task
  participant: string;
  condition: Condition;
  event: string;
  target?: string; // sentence or section id
  flag?: string;
  reason?: string;
  text?: string;
  detail?: string;
}

export interface StudyState {
  participantId: string;
  condition: Condition;
  allowPatientToggle: boolean;
  taskStartedAt?: string;
  taskEndedAt?: string;
  events: LogEvent[];
}

export const flagKey = (targetType: Flag["targetType"], id: string) => `${targetType}:${id}`;
