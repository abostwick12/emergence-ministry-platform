import { internalEventSummarySkill } from "@/lib/emma/skills/internal-event-summary";
import type { RegisteredEmmaSkill } from "@/lib/emma/skills/types";

const REGISTERED_EMMA_SKILLS = [internalEventSummarySkill] as const satisfies readonly RegisteredEmmaSkill[];

export function listRegisteredEmmaSkills(): readonly RegisteredEmmaSkill[] {
  return REGISTERED_EMMA_SKILLS;
}

export function getEmmaSkillByKey(key: string): RegisteredEmmaSkill | null {
  return REGISTERED_EMMA_SKILLS.find((skill) => skill.key === key) ?? null;
}

export function getEmmaSkillByWorkflow(workflow: string): RegisteredEmmaSkill | null {
  return REGISTERED_EMMA_SKILLS.find((skill) => skill.workflow === workflow) ?? null;
}

export function resolveEmmaSkill(keyOrWorkflow: string): RegisteredEmmaSkill | null {
  return getEmmaSkillByKey(keyOrWorkflow) ?? getEmmaSkillByWorkflow(keyOrWorkflow);
}
