"use client";

import { useMemo, useState } from "react";
import type { GameAnswerOption, GameAudioTrack, GameQuestion, TriviaGame } from "@/lib/games/types";
import { themeForCategory } from "@/lib/games/category-themes";
import { clampQuestionDuration, questionTimerPresets } from "@/lib/games/store";

export function GameBuilder({ initialGame }: { initialGame: TriviaGame }) {
  const [game, setGame] = useState(initialGame);
  const [selectedQuestionId, setSelectedQuestionId] = useState(game.questions[0]?.id ?? "");
  const [message, setMessage] = useState("");

  const selectedQuestion = useMemo(
    () => game.questions.find((question) => question.id === selectedQuestionId) ?? game.questions[0],
    [game.questions, selectedQuestionId]
  );

  function updateGame(update: Partial<TriviaGame>) {
    setGame((current) => ({ ...current, ...update }));
  }

  function updateQuestion(questionId: string, update: Partial<GameQuestion>) {
    setGame((current) => ({
      ...current,
      questions: current.questions.map((question) => (question.id === questionId ? { ...question, ...update } : question))
    }));
  }

  function addCategory() {
    const name = `Category ${game.categories.length + 1}`;
    const category = { id: `cat_${Date.now()}`, gameId: game.id, name, sortOrder: game.categories.length + 1, theme: themeForCategory(name) };
    setGame((current) => ({ ...current, categories: [...current.categories, category] }));
  }

  function addQuestion() {
    const categoryId = game.categories[0]?.id ?? `cat_${Date.now()}`;
    const questionId = `q_${Date.now()}`;
    const answers: GameAnswerOption[] = ["Correct answer", "Option B", "Option C", "Option D"].map((answerText, index) => ({
      id: `${questionId}_a_${index}`,
      questionId,
      answerText,
      isCorrect: index === 0,
      sortOrder: index + 1
    }));
    const question: GameQuestion = {
      id: questionId,
      gameId: game.id,
      categoryId,
      questionText: "New trivia question",
      questionType: "multiple_choice",
      explanation: "",
      timeLimitSeconds: game.defaultQuestionDurationSeconds,
      basePoints: game.defaultBasePoints,
      speedBonusPoints: game.defaultSpeedBonusPoints,
      sortOrder: game.questions.length + 1,
      isTiebreaker: false,
      answers
    };
    setGame((current) => ({ ...current, questions: [...current.questions, question] }));
    setSelectedQuestionId(question.id);
  }

  function updateAnswer(questionId: string, answerId: string, update: Partial<GameAnswerOption>) {
    setGame((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === questionId
          ? { ...question, answers: question.answers.map((answer) => (answer.id === answerId ? { ...answer, ...update } : answer)) }
          : question
      )
    }));
  }

  function markCorrect(questionId: string, answerId: string) {
    setGame((current) => ({
      ...current,
      questions: current.questions.map((question) =>
        question.id === questionId
          ? { ...question, answers: question.answers.map((answer) => ({ ...answer, isCorrect: answer.id === answerId })) }
          : question
      )
    }));
  }

  function addAudioTrack() {
    const track: GameAudioTrack = {
      id: `audio_${Date.now()}`,
      trackName: "Countdown track",
      fileUrl: "",
      durationSeconds: 30,
      intendedUse: "countdown",
      loop: false,
      alignToCountdownEnd: true,
      uploadedBy: "usr_admin",
      createdAt: new Date().toISOString()
    };
    updateGame({ audioTracks: [...game.audioTracks, track] });
  }

  function updateAudioTrack(trackId: string, update: Partial<GameAudioTrack>) {
    updateGame({ audioTracks: game.audioTracks.map((track) => (track.id === trackId ? { ...track, ...update } : track)) });
  }

  function validate() {
    if (!game.title.trim()) return "Game title is required.";
    if (!game.categories.length) return "Add at least one category.";
    if (!game.questions.length) return "Add at least one question.";
    for (const question of game.questions) {
      if (!question.questionText.trim()) return "Every question needs text.";
      if (question.timeLimitSeconds < 5 || question.timeLimitSeconds > 300) return "Question timers must be 5 to 300 seconds.";
      if (question.answers.filter((answer) => answer.answerText.trim()).length < 2) return "Every question needs at least two answers.";
      if (question.answers.filter((answer) => answer.isCorrect).length !== 1) return "Every question needs exactly one correct answer.";
    }
    return "";
  }

  async function save(status = game.status) {
    const error = validate();
    if (error) {
      setMessage(error);
      return;
    }
    const response = await fetch(`/api/games/${game.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...game, status })
    });
    const payload = (await response.json()) as { game?: TriviaGame; error?: string };
    if (!response.ok || !payload.game) {
      setMessage(payload.error ?? "Could not save game.");
      return;
    }
    setGame(payload.game);
    setMessage(status === "ready" ? "Game marked ready." : "Draft saved.");
  }

  return (
    <section className="games-workspace game-builder" aria-label="Trivia game builder">
      <div className="games-toolbar">
        <div>
          <p className="eyebrow">Team Trivia Builder</p>
          <h2>{game.title}</h2>
        </div>
        <div className="game-actions">
          <button className="button secondary" type="button" onClick={() => save("draft")}>Save Draft</button>
          <button className="button primary" type="button" onClick={() => save("ready")}>Mark Ready</button>
        </div>
      </div>

      <div className="builder-grid">
        <div className="builder-panel">
          <h3>Game Setup</h3>
          <label><span>Title</span><input value={game.title} onChange={(event) => updateGame({ title: event.target.value })} /></label>
          <label><span>Description</span><textarea value={game.description} onChange={(event) => updateGame({ description: event.target.value })} /></label>
          <TimerControl label="Default question timer" value={game.defaultQuestionDurationSeconds} onChange={(value) => updateGame({ defaultQuestionDurationSeconds: value })} />
          <label><span>Base points</span><input type="number" min={0} value={game.defaultBasePoints} onChange={(event) => updateGame({ defaultBasePoints: Number(event.target.value) })} /></label>
          <label><span>Maximum speed bonus</span><input type="number" min={0} value={game.defaultSpeedBonusPoints} onChange={(event) => updateGame({ defaultSpeedBonusPoints: Number(event.target.value) })} /></label>
          <label className="checkbox-row"><input type="checkbox" checked={game.randomizeAnswerOrder} onChange={(event) => updateGame({ randomizeAnswerOrder: event.target.checked })} /> Randomize answer order</label>
        </div>

        <div className="builder-panel">
          <div className="panel-heading-row">
            <h3>Categories</h3>
            <button className="button secondary" type="button" onClick={addCategory}>Add</button>
          </div>
          {game.categories.map((category) => (
            <div className="category-theme-editor" key={category.id}>
              <label>
                <span>{game.questions.filter((question) => question.categoryId === category.id).length} questions</span>
                <input
                  value={category.name}
                  onChange={(event) =>
                    updateGame({
                      categories: game.categories.map((item) =>
                        item.id === category.id
                          ? { ...item, name: event.target.value, theme: { ...item.theme, introTitle: event.target.value } }
                          : item
                      )
                    })
                  }
                />
              </label>
              <div className="theme-fields">
                <label><span>Background image or graphic</span><input value={category.theme.backgroundImageUrl ?? category.theme.backgroundGraphic ?? ""} onChange={(event) => updateGame({ categories: game.categories.map((item) => item.id === category.id ? { ...item, theme: { ...item.theme, backgroundImageUrl: event.target.value, backgroundGraphic: event.target.value ? undefined : item.theme.backgroundGraphic } } : item) })} /></label>
                <label><span>Icon</span><input value={category.theme.icon} onChange={(event) => updateGame({ categories: game.categories.map((item) => item.id === category.id ? { ...item, theme: { ...item.theme, icon: event.target.value } } : item) })} /></label>
                <label><span>Accent style</span><select value={category.theme.accentStyle} onChange={(event) => updateGame({ categories: game.categories.map((item) => item.id === category.id ? { ...item, theme: { ...item.theme, accentStyle: event.target.value as typeof item.theme.accentStyle } } : item) })}><option value="sunny">Sunny</option><option value="dessert">Dessert</option><option value="wildlife">Wildlife</option><option value="manuscript">Manuscript</option><option value="mixed">Mixed</option><option value="custom">Custom</option></select></label>
                <label><span>Accent color</span><input type="color" value={category.theme.accentColor} onChange={(event) => updateGame({ categories: game.categories.map((item) => item.id === category.id ? { ...item, theme: { ...item.theme, accentColor: event.target.value } } : item) })} /></label>
                <label><span>Transition</span><select value={category.theme.transitionAnimation} onChange={(event) => updateGame({ categories: game.categories.map((item) => item.id === category.id ? { ...item, theme: { ...item.theme, transitionAnimation: event.target.value as typeof item.theme.transitionAnimation } } : item) })}><option value="none">None</option><option value="fade">Fade</option><option value="slide">Slide</option><option value="zoom">Zoom</option></select></label>
                <label className="checkbox-row"><input type="checkbox" checked={category.theme.introEnabled} onChange={(event) => updateGame({ categories: game.categories.map((item) => item.id === category.id ? { ...item, theme: { ...item.theme, introEnabled: event.target.checked } } : item) })} /> Show category intro slide</label>
                <label><span>Intro title</span><input value={category.theme.introTitle ?? ""} onChange={(event) => updateGame({ categories: game.categories.map((item) => item.id === category.id ? { ...item, theme: { ...item.theme, introTitle: event.target.value } } : item) })} /></label>
                <label><span>Intro subtitle</span><input value={category.theme.introSubtitle ?? ""} onChange={(event) => updateGame({ categories: game.categories.map((item) => item.id === category.id ? { ...item, theme: { ...item.theme, introSubtitle: event.target.value } } : item) })} /></label>
              </div>
            </div>
          ))}
        </div>

        <div className="builder-panel question-list">
          <div className="panel-heading-row">
            <h3>Questions</h3>
            <button className="button secondary" type="button" onClick={addQuestion}>Add</button>
          </div>
          {game.questions.map((question, index) => (
            <button
              className={question.id === selectedQuestion?.id ? "question-picker active" : "question-picker"}
              key={question.id}
              type="button"
              onClick={() => setSelectedQuestionId(question.id)}
            >
              <span>{question.isTiebreaker ? "Tie-breaker" : `Q${index + 1}`}</span>
              {question.questionText}
            </button>
          ))}
        </div>

        {selectedQuestion ? (
          <div className="builder-panel question-editor">
            <h3>Question Editor</h3>
            <label>
              <span>Category</span>
              <select value={selectedQuestion.categoryId} onChange={(event) => updateQuestion(selectedQuestion.id, { categoryId: event.target.value })}>
                {game.categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}
              </select>
            </label>
            <label><span>Question text</span><textarea value={selectedQuestion.questionText} onChange={(event) => updateQuestion(selectedQuestion.id, { questionText: event.target.value })} /></label>
            <TimerControl label="Question timer override" value={selectedQuestion.timeLimitSeconds} onChange={(value) => updateQuestion(selectedQuestion.id, { timeLimitSeconds: value })} />
            <label className="checkbox-row"><input type="checkbox" checked={selectedQuestion.isTiebreaker} onChange={(event) => updateQuestion(selectedQuestion.id, { isTiebreaker: event.target.checked })} /> Host-controlled tie-breaker</label>
            <div className="answer-list">
              {selectedQuestion.answers.map((answer) => (
                <div className="answer-edit-row" key={answer.id}>
                  <input type="radio" checked={answer.isCorrect} onChange={() => markCorrect(selectedQuestion.id, answer.id)} aria-label={`Correct answer: ${answer.answerText}`} />
                  <input value={answer.answerText} onChange={(event) => updateAnswer(selectedQuestion.id, answer.id, { answerText: event.target.value })} />
                </div>
              ))}
            </div>
            <label><span>Explanation</span><textarea value={selectedQuestion.explanation ?? ""} onChange={(event) => updateQuestion(selectedQuestion.id, { explanation: event.target.value })} /></label>
            <label>
              <span>Audio override</span>
              <select value={selectedQuestion.audioTrackId ?? ""} onChange={(event) => updateQuestion(selectedQuestion.id, { audioTrackId: event.target.value || undefined })}>
                <option value="">Use game default</option>
                {game.audioTracks.map((track) => <option value={track.id} key={track.id}>{track.trackName}</option>)}
              </select>
            </label>
          </div>
        ) : null}

        <div className="builder-panel audio-panel">
          <div className="panel-heading-row">
            <h3>Audio</h3>
            <button className="button secondary" type="button" onClick={addAudioTrack}>Add track</button>
          </div>
          <label className="checkbox-row"><input type="checkbox" checked={game.audioSettings.enabled} onChange={(event) => updateGame({ audioSettings: { ...game.audioSettings, enabled: event.target.checked } })} /> Enable configured audio</label>
          <label className="checkbox-row"><input type="checkbox" checked={game.audioSettings.muted} onChange={(event) => updateGame({ audioSettings: { ...game.audioSettings, muted: event.target.checked } })} /> Mute by default</label>
          <label><span>Volume</span><input type="range" min={0} max={1} step={0.05} value={game.audioSettings.volume} onChange={(event) => updateGame({ audioSettings: { ...game.audioSettings, volume: Number(event.target.value) } })} /></label>
          {game.audioTracks.map((track) => (
            <div className="audio-track-row" key={track.id}>
              <input value={track.trackName} onChange={(event) => updateAudioTrack(track.id, { trackName: event.target.value })} aria-label="Track name" />
              <input value={track.fileUrl} onChange={(event) => updateAudioTrack(track.id, { fileUrl: event.target.value })} placeholder="Local or licensed audio URL" aria-label="File URL" />
              <select value={track.intendedUse} onChange={(event) => updateAudioTrack(track.id, { intendedUse: event.target.value as GameAudioTrack["intendedUse"] })}>
                <option value="countdown">Countdown</option>
                <option value="tiebreaker">Tie-breaker</option>
                <option value="final_reveal">Final reveal</option>
                <option value="warning">Final five seconds</option>
                <option value="expired">Time expired</option>
                <option value="winner">Winner reveal</option>
              </select>
              <button className="button secondary" type="button" onClick={() => track.fileUrl && new Audio(track.fileUrl).play().catch(() => setMessage("Browser blocked audio preview. Try after interacting with the page."))}>Preview</button>
              <label className="checkbox-row"><input type="checkbox" checked={track.loop} onChange={(event) => updateAudioTrack(track.id, { loop: event.target.checked })} /> Loop</label>
            </div>
          ))}
        </div>

        <div className="builder-panel">
          <h3>Winner Celebration</h3>
          <label className="checkbox-row"><input type="checkbox" checked={game.celebrationSettings.enabled} onChange={(event) => updateGame({ celebrationSettings: { ...game.celebrationSettings, enabled: event.target.checked } })} /> Enable celebration effects</label>
          <label><span>Suspense countdown</span><input type="number" min={0} max={10} value={game.celebrationSettings.suspenseCountdownSeconds} onChange={(event) => updateGame({ celebrationSettings: { ...game.celebrationSettings, suspenseCountdownSeconds: Number(event.target.value) } })} /></label>
          <label className="checkbox-row"><input type="checkbox" checked={game.celebrationSettings.confetti} onChange={(event) => updateGame({ celebrationSettings: { ...game.celebrationSettings, confetti: event.target.checked } })} /> Confetti</label>
          <label className="checkbox-row"><input type="checkbox" checked={game.celebrationSettings.fireworks} onChange={(event) => updateGame({ celebrationSettings: { ...game.celebrationSettings, fireworks: event.target.checked } })} /> Fireworks</label>
          <label className="checkbox-row"><input type="checkbox" checked={game.celebrationSettings.trophy} onChange={(event) => updateGame({ celebrationSettings: { ...game.celebrationSettings, trophy: event.target.checked } })} /> Trophy animation</label>
        </div>
      </div>

      {message ? <p className="form-status" role="status">{message}</p> : null}
    </section>
  );
}

function TimerControl({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="timer-control">
      <span>{label}</span>
      <div className="timer-presets">
        {questionTimerPresets.map((preset) => (
          <button className={value === preset ? "timer-preset active" : "timer-preset"} type="button" key={preset} onClick={() => onChange(preset)}>
            {preset}s
          </button>
        ))}
      </div>
      <label>
        <span>Custom seconds</span>
        <input type="number" min={5} max={300} value={value} onChange={(event) => onChange(clampQuestionDuration(Number(event.target.value)))} />
      </label>
    </div>
  );
}
