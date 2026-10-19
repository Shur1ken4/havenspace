// Professional bodies and countries asked for when requesting pilot access.
// Admins check the registration number by hand against the public register.
export const PROFESSIONAL_BODIES = ["IACP", "PSI", "CORU", "IAHIP", "BACP", "UKCP", "BPS", "HCPC", "other", "none_student"] as const;
export const COUNTRIES = ["IE", "GB", "EU", "other"] as const;

/** Public registers to check against, where one exists. */
export const REGISTER_LINKS: Partial<Record<(typeof PROFESSIONAL_BODIES)[number], string>> = {
  IACP: "https://iacp.ie/page/counsellors",
  PSI: "https://www.psychologicalsociety.ie/find-a-psychologist",
  CORU: "https://coru.ie/public-protection/check-the-register/",
  IAHIP: "https://iahip.org/page-1076158",
  BACP: "https://www.bacp.co.uk/search/Register",
  UKCP: "https://www.psychotherapy.org.uk/find-a-therapist/",
  BPS: "https://www.bps.org.uk/find-psychologist",
  HCPC: "https://www.hcpc-uk.org/check-the-register/",
};
