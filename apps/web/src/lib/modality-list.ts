// The approaches a therapist can choose at sign-up and in Settings. The first one
// chosen is their main approach. Approaches without their own reflection pack use
// the common-factors pack (packages/shared/modalities/map.json).
export const MODALITIES = [
  "cbt", "mi", "dbt", "person_centred", "solution_focused", "integrative", "psychodynamic", "systemic",
  "gestalt", "psychoanalysis", "transactional_analysis", "psychodrama", "ericksonian", "schema", "act", "emdr", "art_therapy",
] as const;
export type Modality = (typeof MODALITIES)[number];
