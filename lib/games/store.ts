import { calculateQuestionAnalytics, calculateTriviaScore, buildLeaderboard } from "@/lib/games/scoring";
import { themeForCategory } from "@/lib/games/category-themes";
import { createSeedGames } from "@/lib/games/seed";
import type {
  GameQuestion,
  GameResponse,
  GameSession,
  GameSessionSnapshot,
  GameStatus,
  GameTeam,
  TriviaGame
} from "@/lib/games/types";

const teamColors = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#ea580c", "#0891b2", "#be123c", "#4f46e5"];
const timerMin = 5;
const timerMax = 300;

type GameStoreState = {
  version: number;
  games: TriviaGame[];
  sessions: GameSession[];
};

const globalStore = globalThis as typeof globalThis & {
  __leadEmergenceGamesStore?: GameStoreState;
};

const state =
  globalStore.__leadEmergenceGamesStore?.version === 1
    ? globalStore.__leadEmergenceGamesStore
    : {
        version: 1,
        games: createSeedGames(),
        sessions: []
      };

globalStore.__leadEmergenceGamesStore = state;

export const questionTimerPresets = [10, 15, 20, 30, 45, 60, 90, 120];

export function clampQuestionDuration(seconds: number) {
  if (!Number.isFinite(seconds)) return 30;
  return Math.min(timerMax, Math.max(timerMin, Math.round(seconds)));
}

export function listGames(includeArchived = false) {
  return state.games.filter((game) => includeArchived || game.status !== "archived");
}

export function getGame(gameId: string) {
  return state.games.find((game) => game.id === gameId);
}

export function createGame(input: Partial<TriviaGame> = {}) {
  const now = new Date().toISOString();
  const game: TriviaGame = {
    id: uid("game"),
    ministryId: "ministry_demo",
    title: input.title?.trim() || "Untitled Team Trivia Game",
    description: input.description ?? "",
    gameType: "team_trivia",
    status: input.status ?? "draft",
    defaultQuestionDurationSeconds: clampQuestionDuration(input.defaultQuestionDurationSeconds ?? 30),
    defaultBasePoints: Math.max(0, input.defaultBasePoints ?? 1000),
    defaultSpeedBonusPoints: Math.max(0, input.defaultSpeedBonusPoints ?? 300),
    randomizeAnswerOrder: input.randomizeAnswerOrder ?? true,
    audioTracks: input.audioTracks ?? [],
    audioSettings: input.audioSettings ?? {
      enabled: false,
      muted: true,
      volume: 0.7
    },
    celebrationSettings: input.celebrationSettings ?? {
      enabled: true,
      suspenseCountdownSeconds: 3,
      confetti: true,
      fireworks: false,
      trophy: true
    },
    createdBy: "usr_admin",
    createdAt: now,
    updatedAt: now,
    categories: input.categories?.length ? input.categories : [{ id: uid("cat"), gameId: "", name: "Round 1", sortOrder: 1, theme: themeForCategory("Round 1") }],
    questions: input.questions ?? []
  };
  game.categories = game.categories.map((category) => ({ ...category, gameId: game.id, theme: category.theme ?? themeForCategory(category.name) }));
  state.games.unshift(game);
  return game;
}

export function upsertGame(gameId: string | undefined, input: Partial<TriviaGame>) {
  const existing = gameId ? getGame(gameId) : undefined;
  if (!existing) return createGame(input);

  existing.title = input.title?.trim() || existing.title;
  existing.description = input.description ?? existing.description;
  existing.status = (input.status as GameStatus | undefined) ?? existing.status;
  existing.defaultQuestionDurationSeconds = clampQuestionDuration(input.defaultQuestionDurationSeconds ?? existing.defaultQuestionDurationSeconds);
  existing.defaultBasePoints = Math.max(0, input.defaultBasePoints ?? existing.defaultBasePoints);
  existing.defaultSpeedBonusPoints = Math.max(0, input.defaultSpeedBonusPoints ?? existing.defaultSpeedBonusPoints);
  existing.randomizeAnswerOrder = input.randomizeAnswerOrder ?? existing.randomizeAnswerOrder;
  existing.audioTracks = input.audioTracks ?? existing.audioTracks;
  existing.audioSettings = input.audioSettings ?? existing.audioSettings;
  existing.celebrationSettings = input.celebrationSettings ?? existing.celebrationSettings;
  existing.categories = (input.categories ?? existing.categories).map((category, index) => ({
    ...category,
    id: category.id || uid("cat"),
    gameId: existing.id,
    sortOrder: index + 1,
    theme: category.theme ?? themeForCategory(category.name)
  }));
  existing.questions = (input.questions ?? existing.questions).map((question, index) => normalizeQuestion(existing, question, index + 1));
  existing.updatedAt = new Date().toISOString();
  return existing;
}

export function duplicateGame(gameId: string) {
  const original = getGame(gameId);
  if (!original) throw new Error("Game not found.");
  const copyId = uid("game");
  const copiedCategories = original.categories.map((category, index) => ({
    ...category,
    id: `${copyId}_cat_${index + 1}`,
    gameId: copyId
  }));
  const categoryMap = new Map(original.categories.map((category, index) => [category.id, copiedCategories[index].id]));
  return createGame({
    ...original,
    id: copyId,
    title: `${original.title} Copy`,
    status: "draft",
    categories: copiedCategories,
    questions: original.questions.map((question, questionIndex) => {
      const questionId = `${copyId}_q_${questionIndex + 1}`;
      return {
        ...question,
        id: questionId,
        gameId: copyId,
        categoryId: categoryMap.get(question.categoryId) ?? copiedCategories[0].id,
        answers: question.answers.map((answer, answerIndex) => ({
          ...answer,
          id: `${questionId}_a_${answerIndex + 1}`,
          questionId
        }))
      };
    })
  });
}

export function archiveGame(gameId: string) {
  const game = getGame(gameId);
  if (!game) throw new Error("Game not found.");
  game.status = "archived";
  game.archivedAt = new Date().toISOString();
  game.updatedAt = game.archivedAt;
  return game;
}

export function createSession(gameId: string) {
  const game = getGame(gameId);
  if (!game) throw new Error("Game not found.");
  const now = new Date().toISOString();
  const session: GameSession = {
    id: uid("session"),
    gameId,
    ministryId: game.ministryId,
    joinCode: uniqueJoinCode(),
    joinPin: String(Math.floor(1000 + Math.random() * 9000)),
    status: "lobby",
    createdBy: "usr_admin",
    createdAt: now,
    updatedAt: now,
    lateJoiningEnabled: false,
    introducedCategoryIds: [],
    teams: [],
    responses: [],
    scoreAdjustments: [],
    events: []
  };
  state.sessions.unshift(session);
  logEvent(session, "session_created", "staff", "usr_admin", { gameId });
  return session;
}

export function getSession(sessionId: string) {
  return state.sessions.find((session) => session.id === sessionId);
}

export function getSessionByJoinCode(joinCode: string) {
  return state.sessions.find((session) => session.joinCode.toLowerCase() === joinCode.toLowerCase());
}

export function listSessionsForGame(gameId: string) {
  return state.sessions.filter((session) => session.gameId === gameId);
}

export function getSnapshot(sessionId: string): GameSessionSnapshot {
  const session = getSession(sessionId);
  if (!session) throw new Error("Session not found.");
  const game = getGame(session.gameId);
  if (!game) throw new Error("Game not found.");
  const currentQuestion = session.currentQuestionId ? game.questions.find((question) => question.id === session.currentQuestionId) : undefined;
  return {
    game,
    session,
    currentQuestion,
    leaderboard: buildLeaderboard({
      teams: session.teams,
      questions: game.questions.filter((question) => !question.isTiebreaker || session.responses.some((response) => response.questionId === question.id)),
      responses: session.responses,
      adjustments: session.scoreAdjustments
    }),
    questionAnalytics: calculateQuestionAnalytics({
      questions: game.questions,
      categories: game.categories,
      teams: session.teams,
      responses: session.responses
    })
  };
}

export function joinSession(joinCode: string, input: { teamName: string; pin?: string; reconnectToken?: string }) {
  const session = getSessionByJoinCode(joinCode);
  if (!session) throw new Error("That join code is not active.");
  if (session.status !== "lobby" && !session.lateJoiningEnabled) throw new Error("This game has already started.");
  if (session.joinPin && input.pin !== session.joinPin) throw new Error("The lobby PIN is not correct.");

  const normalizedName = normalizeTeamName(input.teamName);
  if (!normalizedName) throw new Error("Enter a team name.");

  const existingReconnectToken = input.reconnectToken;
  const existingByToken = existingReconnectToken
    ? session.teams.find((team) => team.connectionTokenHash === hashToken(existingReconnectToken) && !team.isRemoved)
    : undefined;
  if (existingByToken) {
    existingByToken.lastSeenAt = new Date().toISOString();
    existingByToken.isConnected = true;
    return { team: existingByToken, reconnectToken: existingReconnectToken! };
  }

  if (session.teams.some((team) => !team.isRemoved && normalizeTeamName(team.teamName).toLowerCase() === normalizedName.toLowerCase())) {
    throw new Error("That team name is already taken.");
  }

  const reconnectToken = randomToken();
  const now = new Date().toISOString();
  const team: GameTeam = {
    id: uid("team"),
    sessionId: session.id,
    teamName: normalizedName,
    teamColor: teamColors[session.teams.length % teamColors.length],
    connectionTokenHash: hashToken(reconnectToken),
    joinedAt: now,
    lastSeenAt: now,
    isConnected: true,
    isRemoved: false
  };
  session.teams.push(team);
  session.updatedAt = now;
  logEvent(session, "team_joined", "team", team.id, { teamName: team.teamName });
  return { team, reconnectToken };
}

export function updateSession(sessionId: string, action: string, input: Record<string, unknown> = {}) {
  const session = getSession(sessionId);
  if (!session) throw new Error("Session not found.");
  const game = getGame(session.gameId);
  if (!game) throw new Error("Game not found.");
  const now = new Date().toISOString();

  if (action === "start") {
    session.status = "active";
    session.startedAt = now;
    logEvent(session, "game_started", "staff", "usr_admin", {});
  }

  if (action === "open_question") {
    const nextQuestion = getNextQuestion(game, session, String(input.questionId ?? ""));
    if (!nextQuestion) throw new Error("No question available.");
    const category = game.categories.find((item) => item.id === nextQuestion.categoryId);
    if (
      category?.theme.introEnabled &&
      !session.introducedCategoryIds.includes(category.id) &&
      input.skipIntro !== true
    ) {
      session.status = "category_intro";
      session.currentQuestionId = nextQuestion.id;
      session.currentCategoryId = category.id;
      session.currentQuestionStartedAt = undefined;
      session.currentQuestionDurationSeconds = nextQuestion.timeLimitSeconds;
      session.currentQuestionClosedAt = undefined;
      session.answersRevealedAt = undefined;
      session.introducedCategoryIds.push(category.id);
      logEvent(session, "category_intro_opened", "staff", "usr_admin", { categoryId: category.id, questionId: nextQuestion.id });
      session.updatedAt = now;
      return getSnapshot(session.id);
    }
    session.status = "question_open";
    session.currentQuestionId = nextQuestion.id;
    session.currentCategoryId = nextQuestion.categoryId;
    session.currentQuestionDurationSeconds = nextQuestion.timeLimitSeconds;
    session.currentQuestionStartedAt = now;
    session.currentQuestionClosedAt = undefined;
    session.answersRevealedAt = undefined;
    logEvent(session, "question_opened", "staff", "usr_admin", { questionId: nextQuestion.id });
  }

  if (action === "add_time") {
    const question = getCurrentQuestion(game, session);
    if (!question || session.status !== "question_open" || !session.currentQuestionStartedAt) throw new Error("No open question timer.");
    const currentDuration = session.currentQuestionDurationSeconds ?? question.timeLimitSeconds;
    const currentDeadline = new Date(session.currentQuestionStartedAt).getTime() + currentDuration * 1000;
    const desiredDeadline = currentDeadline + 15_000;
    const newDuration = clampQuestionDuration(Math.ceil((desiredDeadline - new Date(session.currentQuestionStartedAt).getTime()) / 1000));
    session.currentQuestionDurationSeconds = newDuration;
    logEvent(session, "question_time_added", "staff", "usr_admin", { questionId: question.id, addedSeconds: 15, durationSeconds: newDuration });
  }

  if (action === "close_question") {
    session.status = "question_closed";
    session.currentQuestionClosedAt = now;
    logEvent(session, "question_closed", "staff", "usr_admin", { questionId: session.currentQuestionId });
  }

  if (action === "reveal_answer") {
    session.status = "answer_revealed";
    session.answersRevealedAt = now;
    logEvent(session, "answer_revealed", "staff", "usr_admin", { questionId: session.currentQuestionId });
  }

  if (action === "complete") {
    session.status = "completed";
    session.endedAt = now;
    const leaderboard = getSnapshot(session.id).leaderboard;
    session.teams.forEach((team) => {
      team.finalRank = leaderboard.find((entry) => entry.teamId === team.id)?.rank;
    });
    logEvent(session, "session_completed", "staff", "usr_admin", {});
  }

  session.updatedAt = now;
  return getSnapshot(session.id);
}

export function submitAnswer(joinCode: string, input: { teamId: string; questionId: string; answerOptionId: string; reconnectToken?: string }) {
  const session = getSessionByJoinCode(joinCode);
  if (!session) throw new Error("Session not found.");
  const game = getGame(session.gameId);
  if (!game) throw new Error("Game not found.");
  const team = session.teams.find((item) => item.id === input.teamId && !item.isRemoved);
  if (!team) throw new Error("Team not found.");
  if (input.reconnectToken && team.connectionTokenHash !== hashToken(input.reconnectToken)) throw new Error("Team reconnect token is not valid.");
  if (session.status !== "question_open") throw new Error("Responses are closed.");
  if (session.currentQuestionId !== input.questionId) throw new Error("That is not the active question.");
  if (session.responses.some((response) => response.teamId === input.teamId && response.questionId === input.questionId)) {
    throw new Error("This team has already answered.");
  }

  const question = getCurrentQuestion(game, session);
  if (!question || !session.currentQuestionStartedAt) throw new Error("Question is not open.");
  const answer = question.answers.find((option) => option.id === input.answerOptionId);
  if (!answer) throw new Error("Answer option does not belong to this question.");

  const submittedAt = new Date();
  const responseTimeMs = Math.max(0, submittedAt.getTime() - new Date(session.currentQuestionStartedAt).getTime());
  const questionDurationMs = (session.currentQuestionDurationSeconds ?? question.timeLimitSeconds) * 1000;
  if (responseTimeMs > questionDurationMs) throw new Error("That answer arrived after the timer ended.");

  const points = calculateTriviaScore({
    isCorrect: answer.isCorrect,
    responseTimeMs,
    questionDurationMs,
    basePoints: question.basePoints,
    maxSpeedBonus: question.speedBonusPoints
  });
  const response: GameResponse = {
    id: uid("response"),
    sessionId: session.id,
    questionId: question.id,
    teamId: team.id,
    answerOptionId: answer.id,
    submittedAt: submittedAt.toISOString(),
    responseTimeMs,
    isCorrect: answer.isCorrect,
    ...points
  };
  session.responses.push(response);
  team.lastSeenAt = submittedAt.toISOString();
  logEvent(session, "response_received", "team", team.id, { questionId: question.id });
  return response;
}

export function teamState(joinCode: string, teamId?: string, reconnectToken?: string) {
  const session = getSessionByJoinCode(joinCode);
  if (!session) throw new Error("Session not found.");
  const snapshot = getSnapshot(session.id);
  const tokenHash = reconnectToken ? hashToken(reconnectToken) : undefined;
  const team = teamId
    ? session.teams.find((item) => item.id === teamId && !item.isRemoved)
    : tokenHash
      ? session.teams.find((item) => item.connectionTokenHash === tokenHash && !item.isRemoved)
      : undefined;
  if (team && reconnectToken && team.connectionTokenHash === hashToken(reconnectToken)) {
    team.lastSeenAt = new Date().toISOString();
    team.isConnected = true;
  }
  const currentResponse = team && snapshot.currentQuestion
    ? session.responses.find((response) => response.teamId === team.id && response.questionId === snapshot.currentQuestion?.id)
    : undefined;
  return { ...snapshot, team, currentResponse };
}

function normalizeQuestion(game: TriviaGame, question: GameQuestion, sortOrder: number): GameQuestion {
  const questionId = question.id || uid("question");
  return {
    ...question,
    id: questionId,
    gameId: game.id,
    categoryId: question.categoryId || game.categories[0]?.id || "",
    timeLimitSeconds: clampQuestionDuration(question.timeLimitSeconds || game.defaultQuestionDurationSeconds),
    basePoints: Math.max(0, question.basePoints ?? game.defaultBasePoints),
    speedBonusPoints: Math.max(0, question.speedBonusPoints ?? game.defaultSpeedBonusPoints),
    sortOrder,
    answers: question.answers.map((answer, index) => ({
      ...answer,
      id: answer.id || uid("answer"),
      questionId,
      sortOrder: index + 1
    }))
  };
}

function getNextQuestion(game: TriviaGame, session: GameSession, requestedQuestionId: string) {
  if (requestedQuestionId) return game.questions.find((question) => question.id === requestedQuestionId);
  const answeredQuestionIds = new Set(session.responses.map((response) => response.questionId));
  return game.questions
    .filter((question) => !question.isTiebreaker)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .find((question) => !answeredQuestionIds.has(question.id) && question.id !== session.currentQuestionId);
}

function getCurrentQuestion(game: TriviaGame, session: GameSession) {
  return session.currentQuestionId ? game.questions.find((question) => question.id === session.currentQuestionId) : undefined;
}

function normalizeTeamName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 40);
}

function uniqueJoinCode() {
  let code = "";
  do {
    code = Math.random().toString(36).slice(2, 8).toUpperCase();
  } while (state.sessions.some((session) => session.joinCode === code));
  return code;
}

function logEvent(session: GameSession, eventType: string, actorType: "staff" | "team" | "system", actorId: string | undefined, eventData: Record<string, unknown>) {
  session.events.push({
    id: uid("event"),
    sessionId: session.id,
    eventType,
    actorType,
    actorId,
    eventData,
    createdAt: new Date().toISOString()
  });
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

function randomToken() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}_${Math.random().toString(36).slice(2)}`;
}

function hashToken(token: string) {
  let hash = 0;
  for (let index = 0; index < token.length; index += 1) {
    hash = (hash << 5) - hash + token.charCodeAt(index);
    hash |= 0;
  }
  return `local_${Math.abs(hash)}`;
}
