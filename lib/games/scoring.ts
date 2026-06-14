import type { GameQuestion, GameResponse, GameScoreAdjustment, GameTeam, LeaderboardEntry, QuestionAnalytics } from "@/lib/games/types";

export function calculateTriviaScore(input: {
  isCorrect: boolean;
  responseTimeMs: number;
  questionDurationMs: number;
  basePoints: number;
  maxSpeedBonus: number;
}) {
  if (!input.isCorrect) {
    return { basePointsAwarded: 0, speedBonusAwarded: 0, totalPointsAwarded: 0 };
  }

  const duration = Math.max(0, input.questionDurationMs);
  const response = Math.max(0, input.responseTimeMs);
  const speedRatio = duration === 0 ? 0 : Math.max(0, 1 - response / duration);
  const speedBonusAwarded = Math.round(Math.max(0, input.maxSpeedBonus) * speedRatio);
  const basePointsAwarded = Math.max(0, input.basePoints);

  return {
    basePointsAwarded,
    speedBonusAwarded,
    totalPointsAwarded: basePointsAwarded + speedBonusAwarded
  };
}

export function buildLeaderboard(input: {
  teams: GameTeam[];
  questions: GameQuestion[];
  responses: GameResponse[];
  adjustments: GameScoreAdjustment[];
}): LeaderboardEntry[] {
  const playedQuestions = input.questions.filter((question) => !question.isTiebreaker);

  const entries = input.teams
    .filter((team) => !team.isRemoved)
    .map((team) => {
      const teamResponses = input.responses.filter((response) => response.teamId === team.id);
      const correctResponses = teamResponses.filter((response) => response.isCorrect);
      const totalAdjustments = input.adjustments
        .filter((adjustment) => adjustment.teamId === team.id)
        .reduce((sum, adjustment) => sum + adjustment.pointsDelta, 0);
      const totalScore = teamResponses.reduce((sum, response) => sum + response.totalPointsAwarded, 0) + totalAdjustments;
      const averageCorrectResponseMs = correctResponses.length
        ? Math.round(correctResponses.reduce((sum, response) => sum + response.responseTimeMs, 0) / correctResponses.length)
        : null;

      return {
        teamId: team.id,
        teamName: team.teamName,
        totalScore,
        correctAnswers: correctResponses.length,
        incorrectAnswers: teamResponses.filter((response) => !response.isCorrect).length,
        unansweredQuestions: Math.max(0, playedQuestions.length - teamResponses.length),
        accuracy: teamResponses.length ? Math.round((correctResponses.length / teamResponses.length) * 100) : 0,
        averageCorrectResponseMs,
        fastestCorrectResponseMs: correctResponses.length ? Math.min(...correctResponses.map((response) => response.responseTimeMs)) : null,
        longestCorrectStreak: calculateLongestCorrectStreak(playedQuestions, teamResponses),
        rank: 0
      };
    })
    .sort((a, b) => b.totalScore - a.totalScore || b.correctAnswers - a.correctAnswers || a.teamName.localeCompare(b.teamName));

  let previousScore: number | null = null;
  let previousRank = 0;
  return entries.map((entry, index) => {
    const rank = previousScore === entry.totalScore ? previousRank : index + 1;
    previousScore = entry.totalScore;
    previousRank = rank;
    return { ...entry, rank };
  });
}

export function calculateQuestionAnalytics(input: {
  questions: GameQuestion[];
  categories: Array<{ id: string; name: string }>;
  teams: GameTeam[];
  responses: GameResponse[];
}): QuestionAnalytics[] {
  const activeTeams = input.teams.filter((team) => !team.isRemoved);

  return input.questions.map((question) => {
    const responses = input.responses.filter((response) => response.questionId === question.id);
    const correctAnswer = question.answers.find((answer) => answer.isCorrect);
    const correctResponses = responses.filter((response) => response.isCorrect);
    const categoryName = input.categories.find((category) => category.id === question.categoryId)?.name ?? "Uncategorized";
    const averageResponseMs = responses.length
      ? Math.round(responses.reduce((sum, response) => sum + response.responseTimeMs, 0) / responses.length)
      : null;
    const fastestCorrect = correctResponses.sort((a, b) => a.responseTimeMs - b.responseTimeMs)[0];

    return {
      questionId: question.id,
      categoryName,
      questionText: question.questionText,
      correctAnswer: correctAnswer?.answerText ?? "",
      percentCorrect: activeTeams.length ? Math.round((correctResponses.length / activeTeams.length) * 100) : 0,
      teamsAnswered: responses.length,
      unanswered: Math.max(0, activeTeams.length - responses.length),
      averageResponseMs,
      fastestCorrectTeam: fastestCorrect ? activeTeams.find((team) => team.id === fastestCorrect.teamId)?.teamName : undefined,
      distribution: question.answers.map((answer) => ({
        answerText: answer.answerText,
        isCorrect: answer.isCorrect,
        count: responses.filter((response) => response.answerOptionId === answer.id).length
      }))
    };
  });
}

function calculateLongestCorrectStreak(questions: GameQuestion[], responses: GameResponse[]) {
  const responseByQuestion = new Map(responses.map((response) => [response.questionId, response]));
  let longest = 0;
  let current = 0;

  for (const question of questions) {
    if (responseByQuestion.get(question.id)?.isCorrect) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
  }

  return longest;
}
