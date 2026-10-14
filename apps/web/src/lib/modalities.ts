import general from "@psych/shared/modalities/general.json";
import mi from "@psych/shared/modalities/mi.json";
import cbt from "@psych/shared/modalities/cbt.json";
import person_centred from "@psych/shared/modalities/person_centred.json";
import solution_focused from "@psych/shared/modalities/solution_focused.json";
import dbt from "@psych/shared/modalities/dbt.json";
import map from "@psych/shared/modalities/map.json";

export type ModalityPack = typeof general;
export const packs: Record<string, ModalityPack> = { general, mi, cbt, person_centred, solution_focused, dbt };

export function packFor(modality: string | undefined): ModalityPack {
  const id = (map as Record<string, string>)[modality ?? ""] ?? modality ?? "general";
  return packs[id] ?? general;
}
