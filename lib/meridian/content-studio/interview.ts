import type {
  ContentInterviewQuestion,
  ContentInterviewTurn,
  ContentPlatform,
  ContentSession,
  InterviewDimension,
  InterviewPlaybookData
} from "@/lib/meridian/content-studio/types";

export function selectOpeningQuestion(input: {
  playbook: InterviewPlaybookData;
  topic: string;
  platforms: ContentPlatform[];
}): ContentInterviewQuestion {
  const dimension = rankDimensions(input.playbook.dimensions, [], input.platforms)[0];
  return questionFor(dimension, input.topic, input.platforms, 1, 1, input.playbook.maxQuestions);
}

export function advanceInterview(input: {
  playbook: InterviewPlaybookData;
  session: ContentSession;
  answer: string;
  finishNow: boolean;
  now: string;
}): {
  status: "collecting" | "ready";
  transcript: ContentInterviewTurn[];
  coveredDimensions: string[];
  questionCount: number;
  currentQuestion: ContentInterviewQuestion | null;
  stopReason: "user_finished" | "coverage_complete" | "question_limit" | null;
} {
  const current = input.session.currentQuestion;
  if (!current) throw new Error("The interview does not have an active question.");
  const dimension = input.playbook.dimensions.find((candidate) => candidate.id === current.dimensionId);
  if (!dimension) throw new Error("The active interview dimension is no longer available.");

  const answer = input.answer.replace(/\s+/g, " ").trim();
  const transcript = [...input.session.transcript, {
    dimensionId: dimension.id,
    question: current.prompt,
    answer,
    attempt: current.attempt,
    answeredAt: input.now
  }];
  const questionCount = input.session.questionCount + 1;
  const sufficientlySpecific = answerIsSpecific(answer, dimension.minWords) || current.attempt >= dimension.maxAttempts;
  const coveredDimensions = sufficientlySpecific
    ? Array.from(new Set([...input.session.coveredDimensions, dimension.id]))
    : input.session.coveredDimensions;

  if (input.finishNow) return ready("user_finished");
  if (questionCount >= input.session.maxQuestions) return ready("question_limit");

  const requiredIds = input.playbook.dimensions.filter((candidate) => candidate.required).map((candidate) => candidate.id);
  const coverageComplete = questionCount >= input.playbook.minQuestions
    && requiredIds.every((id) => coveredDimensions.includes(id));
  if (coverageComplete) return ready("coverage_complete");

  if (!sufficientlySpecific) {
    return {
      status: "collecting",
      transcript,
      coveredDimensions,
      questionCount,
      currentQuestion: questionFor(
        dimension,
        input.session.topic,
        input.session.platforms,
        current.attempt + 1,
        questionCount + 1,
        input.session.maxQuestions,
        answer
      ),
      stopReason: null
    };
  }

  const next = rankDimensions(input.playbook.dimensions, coveredDimensions, input.session.platforms)[0];
  if (!next) return ready("coverage_complete");
  return {
    status: "collecting",
    transcript,
    coveredDimensions,
    questionCount,
    currentQuestion: questionFor(next, input.session.topic, input.session.platforms, 1, questionCount + 1, input.session.maxQuestions, answer),
    stopReason: null
  };

  function ready(stopReason: "user_finished" | "coverage_complete" | "question_limit") {
    return {
      status: "ready" as const,
      transcript,
      coveredDimensions,
      questionCount,
      currentQuestion: null,
      stopReason
    };
  }
}

export function contentBrief(session: ContentSession) {
  return {
    topic: session.topic,
    contentType: session.contentType,
    platforms: session.platforms,
    interviewMode: session.interviewMode,
    answers: session.transcript.map((turn) => ({ dimension: turn.dimensionId, answer: turn.answer }))
  };
}

function rankDimensions(dimensions: InterviewDimension[], covered: string[], platforms: ContentPlatform[]) {
  return dimensions
    .filter((dimension) => !covered.includes(dimension.id))
    .map((dimension) => ({
      dimension,
      score: dimension.priority
        + (dimension.required ? 30 : 0)
        + dimension.platformAffinity.filter((platform) => platforms.includes(platform)).length * 12
    }))
    .sort((left, right) => right.score - left.score || left.dimension.id.localeCompare(right.dimension.id))
    .map(({ dimension }) => dimension);
}

function questionFor(
  dimension: InterviewDimension,
  topic: string,
  platforms: ContentPlatform[],
  attempt: number,
  questionNumber: number,
  maximumQuestions: number,
  previousAnswer = ""
): ContentInterviewQuestion {
  const pool = attempt > 1 && dimension.followups.length ? dimension.followups : dimension.probes;
  const seed = `${topic}|${platforms.join("|")}|${dimension.id}|${attempt}|${previousAnswer.length}`;
  const prompt = pool[stableIndex(seed, pool.length)]
    .replaceAll("{topic}", topic)
    .replaceAll("{platforms}", platforms.map((platform) => platform.replace(/_/g, " ")).join(", "));
  return { dimensionId: dimension.id, prompt, attempt, questionNumber, maximumQuestions };
}

function answerIsSpecific(answer: string, minWords: number) {
  const words = answer.split(/\s+/).filter(Boolean);
  if (words.length >= minWords + 5) return true;
  const concreteSignal = /\b(?:\d{1,4}|today|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday|because|so that|instead of|at |by |for )\b/i.test(answer);
  return words.length >= minWords && concreteSignal;
}

function stableIndex(value: string, size: number) {
  let hash = 0;
  for (const character of value) hash = ((hash << 5) - hash + character.charCodeAt(0)) | 0;
  return Math.abs(hash) % Math.max(1, size);
}
