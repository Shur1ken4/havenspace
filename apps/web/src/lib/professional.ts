// Professional bodies and countries asked for when requesting pilot access.
// Admins check the registration number by hand against the public register.
// CLINICAL-REVIEW: the list of recognised bodies per country.

export const COUNTRIES = ["IE", "GB", "EU", "UA", "RU", "other"] as const;
export type Country = (typeof COUNTRIES)[number];

/** Bodies grouped by where they register people; the sign-up form shows the
 *  person's own country first. "other" lets them type any organisation. */
export const BODY_GROUPS: Record<Exclude<Country, "other">, readonly string[]> = {
  IE: ["IACP", "PSI", "CORU", "IAHIP", "ICP"],
  GB: ["BACP", "UKCP", "BPS", "HCPC", "BABCP", "NCPS"],
  EU: ["EAP_ECP", "EUROPSY", "EU_NATIONAL"],
  UA: ["UA_USP", "UA_NPA"],
  RU: ["RU_RPA", "RU_OPPL", "RU_RPO", "RU_AKP", "RU_DIPLOMA"],
};

export const PROFESSIONAL_BODIES = [
  "IACP", "PSI", "CORU", "IAHIP", "ICP",
  "BACP", "UKCP", "BPS", "HCPC", "BABCP", "NCPS",
  "EAP_ECP", "EUROPSY", "EU_NATIONAL",
  "UA_USP", "UA_NPA",
  "RU_RPA", "RU_OPPL", "RU_RPO", "RU_AKP", "RU_DIPLOMA",
  "other", "none_student",
] as const;
export type ProfessionalBody = (typeof PROFESSIONAL_BODIES)[number];

/** Groups in display order: the chosen country's bodies first. */
export function bodyGroupsFor(country: Country): { country: Exclude<Country, "other">; bodies: readonly string[] }[] {
  const order = (Object.keys(BODY_GROUPS) as Exclude<Country, "other">[]).sort((a, b) => Number(b === country) - Number(a === country));
  return order.map((c) => ({ country: c, bodies: BODY_GROUPS[c] }));
}

/** A sensible default body when the country changes. */
export function defaultBodyFor(country: Country): ProfessionalBody {
  return country === "other" ? "other" : (BODY_GROUPS[country][0] as ProfessionalBody);
}

/** Public registers to check against, where one exists. */
export const REGISTER_LINKS: Partial<Record<ProfessionalBody, string>> = {
  IACP: "https://iacp.ie/page/counsellors",
  PSI: "https://www.psychologicalsociety.ie/find-a-psychologist",
  CORU: "https://coru.ie/public-protection/check-the-register/",
  IAHIP: "https://iahip.org/page-1076158",
  BACP: "https://www.bacp.co.uk/search/Register",
  UKCP: "https://www.psychotherapy.org.uk/find-a-therapist/",
  BPS: "https://www.bps.org.uk/find-psychologist",
  HCPC: "https://www.hcpc-uk.org/check-the-register/",
  EAP_ECP: "https://www.europsyche.org",
  EUROPSY: "https://www.europsy.eu",
  RU_OPPL: "https://oppl.ru",
  RU_RPO: "https://psyrus.ru",
};
