export type StudentJourneyKind = "formation" | "question";
export type StudentJourneyPractice = "embodied" | "guided";
export type StudentJourneyStudyPath = "word" | "inductive";

export type StudentJourneyEntry = {
  journeyId: string;
  journeyKind: StudentJourneyKind;
  promptId?: string;
  entrySequence: number;
  scriptureReflection: string;
  questionReflection: string;
  practiceReflection: string;
  livingReflection: string;
  fruitReflection: string;
  selectedPractice: StudentJourneyPractice;
  studyPath: StudentJourneyStudyPath;
  selectedReadingId: string;
  savedAt: string;
  updatedAt: string;
};

export type SaveStudentJourneyEntryInput = Omit<StudentJourneyEntry, "savedAt" | "updatedAt">;

export function studentJourneyEntryKey(journeyId: string, entrySequence: number) {
  return `${journeyId}:entry-${entrySequence}`;
}
