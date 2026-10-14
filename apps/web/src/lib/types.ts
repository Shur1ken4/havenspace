// Shapes of the AI outputs stored as JSON. Kept in sync with the worker's
// Pydantic models (services/worker/worker/schemas.py).

export type NoteContent = {
  format: "SOAP" | "DAP" | "BIRP" | "FREE";
  sections: { key: string; text: string }[];
};

export type Evidence = { segment_ids: number[]; quote: string };
export type ReflectionItem = Evidence & { text: string };
export type RubricScore = { dimension_id: string; score: number; rationale: string; segment_ids: number[] };

export type ReflectionContent = {
  strengths: ReflectionItem[];
  missed_openings: ReflectionItem[];
  try_next: ReflectionItem[];
  rubric: RubricScore[];
};

export type Segment = { idx: number; speaker: string; start_ms: number; end_ms: number; text: string };
