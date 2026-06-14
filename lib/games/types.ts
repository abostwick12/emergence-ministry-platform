export type GameType = "team_trivia";
export type GameStatus = "draft" | "ready" | "archived";
export type QuestionType = "multiple_choice";
export type SessionStatus = "lobby" | "active" | "category_intro" | "question_open" | "question_closed" | "answer_revealed" | "completed" | "cancelled";

export type GameAnswerOption = {
  id: string;
  questionId: string;
  answerText: string;
  isCorrect: boolean;
  sortOrder: number;
};

export type GameAudioTrack = {
  id: string;
  trackName: string;
  fileUrl: string;
  durationSeconds: number;
  intendedUse: "countdown" | "tiebreaker" | "final_reveal" | "warning" | "expired" | "winner";
  loop: boolean;
  alignToCountdownEnd: boolean;
  uploadedBy: string;
  createdAt: string;
};

export type GameAudioSettings = {
  enabled: boolean;
  muted: boolean;
  volume: number;
  defaultCountdownTrackId?: string;
  tiebreakerTrackId?: string;
  finalRevealTrackId?: string;
  finalFiveSecondTrackId?: string;
  timeExpiredTrackId?: string;
  winnerRevealTrackId?: string;
};

export type CategoryTheme = {
  backgroundGraphic?: string;
  backgroundImageUrl?: string;
  icon: string;
  accentStyle: "sunny" | "dessert" | "wildlife" | "manuscript" | "mixed" | "custom";
  accentColor: string;
  transitionAnimation: "none" | "fade" | "slide" | "zoom";
  introEnabled: boolean;
  introTitle?: string;
  introSubtitle?: string;
};

export type GameCelebrationSettings = {
  enabled: boolean;
  suspenseCountdownSeconds: number;
  confetti: boolean;
  fireworks: boolean;
  trophy: boolean;
};

export type GameQuestion = {
  id: string;
  gameId: string;
  categoryId: string;
  questionText: string;
  questionType: QuestionType;
  explanation?: string;
  mediaUrl?: string;
  timeLimitSeconds: number;
  basePoints: number;
  speedBonusPoints: number;
  audioTrackId?: string;
  sortOrder: number;
  isTiebreaker: boolean;
  answers: GameAnswerOption[];
};

export type GameCategory = {
  id: string;
  gameId: string;
  name: string;
  sortOrder: number;
  theme: CategoryTheme;
};

export type TriviaGame = {
  id: string;
  ministryId: string;
  title: string;
  description: string;
  gameType: GameType;
  status: GameStatus;
  defaultQuestionDurationSeconds: number;
  defaultBasePoints: number;
  defaultSpeedBonusPoints: number;
  randomizeAnswerOrder: boolean;
  audioTracks: GameAudioTrack[];
  audioSettings: GameAudioSettings;
  celebrationSettings: GameCelebrationSettings;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt?: string;
  lastPlayedAt?: string;
  categories: GameCategory[];
  questions: GameQuestion[];
};

export type GameTeam = {
  id: string;
  sessionId: string;
  teamName: string;
  teamColor: string;
  connectionTokenHash: string;
  joinedAt: string;
  lastSeenAt: string;
  isConnected: boolean;
  isRemoved: boolean;
  finalRank?: number;
};

export type GameResponse = {
  id: string;
  sessionId: string;
  questionId: string;
  teamId: string;
  answerOptionId: string;
  submittedAt: string;
  responseTimeMs: number;
  isCorrect: boolean;
  basePointsAwarded: number;
  speedBonusAwarded: number;
  totalPointsAwarded: number;
};

export type GameScoreAdjustment = {
  id: string;
  sessionId: string;
  teamId: string;
  questionId?: string;
  pointsDelta: number;
  reason: string;
  createdBy: string;
  createdAt: string;
};

export type GameSessionEvent = {
  id: string;
  sessionId: string;
  eventType: string;
  actorType: "staff" | "team" | "system";
  actorId?: string;
  eventData: Record<string, unknown>;
  createdAt: string;
};

export type GameSession = {
  id: string;
  gameId: string;
  ministryId: string;
  joinCode: string;
  joinPin: string;
  status: SessionStatus;
  currentQuestionId?: string;
  currentCategoryId?: string;
  currentQuestionDurationSeconds?: number;
  currentQuestionStartedAt?: string;
  currentQuestionClosedAt?: string;
  answersRevealedAt?: string;
  startedAt?: string;
  endedAt?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lateJoiningEnabled: boolean;
  introducedCategoryIds: string[];
  teams: GameTeam[];
  responses: GameResponse[];
  scoreAdjustments: GameScoreAdjustment[];
  events: GameSessionEvent[];
};

export type LeaderboardEntry = {
  teamId: string;
  teamName: string;
  totalScore: number;
  correctAnswers: number;
  incorrectAnswers: number;
  unansweredQuestions: number;
  accuracy: number;
  averageCorrectResponseMs: number | null;
  fastestCorrectResponseMs: number | null;
  longestCorrectStreak: number;
  rank: number;
};

export type QuestionAnalytics = {
  questionId: string;
  categoryName: string;
  questionText: string;
  correctAnswer: string;
  percentCorrect: number;
  teamsAnswered: number;
  unanswered: number;
  averageResponseMs: number | null;
  fastestCorrectTeam?: string;
  distribution: Array<{ answerText: string; count: number; isCorrect: boolean }>;
};

export type GameSessionSnapshot = {
  game: TriviaGame;
  session: GameSession;
  currentQuestion?: GameQuestion;
  leaderboard: LeaderboardEntry[];
  questionAnalytics: QuestionAnalytics[];
};
