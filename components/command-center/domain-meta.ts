import type { PersonalDomain } from "@/lib/command-center/types";

export const DOMAIN_LABELS: Record<PersonalDomain, string> = {
  military_transition: "Military Transition",
  sotf_fellowship: "SOTF Fellowship",
  job_search: "Job Search",
  life: "Life"
};

export const DOMAIN_ORDER: PersonalDomain[] = ["military_transition", "sotf_fellowship", "job_search", "life"];

const DOMAIN_CLASS_SUFFIX: Record<PersonalDomain, string> = {
  military_transition: "military",
  sotf_fellowship: "sotf",
  job_search: "job_search",
  life: "life"
};

export function domainClassName(domain: PersonalDomain): string {
  return `command-center-domain-${DOMAIN_CLASS_SUFFIX[domain]}`;
}
