const medicationQuestionPattern = /\b(medication|medicine|meds|dose|doses|intake)\b/i;

export function shouldUseMedicalCommandContext(canAccessMedicalCommand: boolean, prompt: string): boolean {
  return canAccessMedicalCommand && medicationQuestionPattern.test(prompt);
}
