"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BookOpen, Check, FileText, ListChecks, LoaderCircle, MessageSquareText, Save, Send, Sparkles, X } from "lucide-react";

import { YouVersionReaderWindow } from "@/components/student/youversion-reader-window";
import { buildYouVersionReaderLink } from "@/lib/scripture/youversion";
import { competitionGuestSermon, competitionLeaderResources } from "@/lib/guest/competition-demo-content";

type PrepAction = {
  id: "outline" | "leader_guide" | "slide_plan" | "small_group_questions";
  label: string;
  tone: "cyan" | "gold";
};

const prepActions: PrepAction[] = [
  { id: "outline", label: "Generate outline", tone: "cyan" },
  { id: "leader_guide", label: "Generate leader guide", tone: "cyan" },
  { id: "slide_plan", label: "Generate slide plan", tone: "gold" },
  { id: "small_group_questions", label: "Generate small group questions", tone: "gold" }
];

const initialChecklist = [
  { id: "big-idea", label: "Big idea named", complete: true },
  { id: "leader-guide", label: "Leader guide sent", complete: true },
  { id: "slides", label: "Slide plan saved", complete: false },
  { id: "questions", label: "Small group questions posted", complete: false },
  { id: "prayer", label: "Prayer request written", complete: false }
];

type GeneratedResource = {
  contentMarkdown: string;
  provider: string;
  model: string;
  provenance?: {
    meridianRan: boolean;
    aiProvider: string;
    model: string;
    selectedSourceIds: string[];
    selectedSourceTypes: string[];
    fallbackUsed: boolean;
    fallbackReason: string;
    validationResult: string;
  };
  sources: string[];
  summary: string;
  title: string;
  warnings: string[];
};

type EmmaChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: string[];
};

const draftStorageKey = "lead-emergence.sermon-prep.current";

export function LeaderPreparationPage({ readOnly = false, guestSeed = false }: { readOnly?: boolean; guestSeed?: boolean }) {
  const [title, setTitle] = useState(guestSeed ? competitionGuestSermon.title : "When the King Kneels");
  const [passage, setPassage] = useState(guestSeed ? competitionGuestSermon.passage : "John 13:1-17");
  const [bigIdea, setBigIdea] = useState(guestSeed ? competitionGuestSermon.bigIdea : "Real authority stoops. If Jesus is Lord, then love looks like a towel, not a title.");
  const [body, setBody] = useState(guestSeed ? competitionGuestSermon.body : (
    "Jesus knew where he came from and where he was going, and out of that grounded identity he picked up a towel.\n\n" +
      "We usually think power protects us from the low place. In the upper room, love takes Jesus toward it.\n\n" +
      "Notice the timing: this happens right before betrayal, denial, and the cross. Jesus isn't rewarding the disciples. He is showing them what the whole kingdom looks like from the inside.\n\n" +
      "Peter's response - \"You shall never wash my feet\" - sounds humble, but it's actually resistance. To follow Jesus is to receive from him before you serve like him.\n\n" +
      "Where in your week are you refusing the towel - either to receive it or to pick it up?"
  ));
  const [checklist, setChecklist] = useState(initialChecklist);
  const [draftStatus, setDraftStatus] = useState(readOnly ? "Guest contest access is read-only." : "Draft loaded from starter content.");
  const [actionStatus, setActionStatus] = useState(readOnly ? "Resource generation is disabled in guest mode." : "Save the sermon, then generate resources for Weekly Resources.");
  const [generating, setGenerating] = useState<PrepAction["id"] | null>(null);
  const [generatedResources, setGeneratedResources] = useState<GeneratedResource[]>([]);
  const [emmaOpen, setEmmaOpen] = useState(false);
  const [emmaPrompt, setEmmaPrompt] = useState("Give me two leader discussion questions from this big idea.");
  const [emmaLoading, setEmmaLoading] = useState(false);
  const [emmaMessages, setEmmaMessages] = useState<EmmaChatMessage[]>([
    {
      id: "emma-welcome",
      role: "assistant",
      content: "Ask for sermon illustrations, leader guide language, outlines, or student-ready questions. I will use the saved sermon context on this page.",
      sources: ["Current sermon draft", "Selected Scripture reference", "Meridian ministry context"]
    }
  ]);

  const readerLink = useMemo(() => buildYouVersionReaderLink(passage), [passage]);
  const completeCount = checklist.filter((item) => item.complete).length;
  const nextChecklistItem = checklist.find((item) => !item.complete);
  const guideAction: PrepAction = prepActions.find((action) => action.id === "leader_guide") ?? { id: "leader_guide", label: "Generate leader guide", tone: "cyan" };
  const questionsAction: PrepAction = prepActions.find((action) => action.id === "small_group_questions") ?? { id: "small_group_questions", label: "Generate small group questions", tone: "gold" };

  useEffect(() => {
    if (readOnly) return;
    try {
      const saved = window.localStorage.getItem(draftStorageKey);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<Record<"title" | "passage" | "bigIdea" | "body", string>>;
      if (typeof parsed.title === "string") setTitle(parsed.title);
      if (typeof parsed.passage === "string") setPassage(parsed.passage);
      if (typeof parsed.bigIdea === "string") setBigIdea(parsed.bigIdea);
      if (typeof parsed.body === "string") setBody(parsed.body);
      setDraftStatus("Saved sermon draft restored.");
    } catch {
      setDraftStatus("Starter sermon loaded. Saved draft could not be read.");
    }
  }, [readOnly]);

  function markDraftChanged(setter: (value: string) => void, value: string) {
    if (readOnly) return;
    setter(value);
    setDraftStatus("Unsaved sermon changes.");
  }

  function saveDraft() {
    if (readOnly) return;
    window.localStorage.setItem(draftStorageKey, JSON.stringify({ title, passage, bigIdea, body, savedAt: new Date().toISOString() }));
    setDraftStatus("Sermon saved in this browser.");
  }

  async function runGenerateAction(action: PrepAction) {
    if (readOnly) {
      setActionStatus("AI generation is disabled in guest mode. Available after sign-in.");
      return;
    }
    setGenerating(action.id);
    setActionStatus(`${action.label.replace("Generate ", "")} is generating through Meridian...`);
    try {
      const response = await fetch("/api/leader-prep/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: action.id, title, passage, bigIdea, body })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        resource?: GeneratedResource;
        saved?: { weeklyResourceCard?: boolean; weeklyResourceDocument?: boolean };
        warnings?: string[];
      };
      if (!response.ok || !payload.resource) throw new Error(payload.error ?? "Resource could not be generated.");
      setGeneratedResources((current) => [payload.resource!, ...current.filter((item) => item.title !== payload.resource!.title)].slice(0, 4));
      setActionStatus(
        payload.saved?.weeklyResourceCard
          ? `${payload.resource.title} generated and saved to Weekly Resources.`
          : `${payload.resource.title} generated; review the warning before using it.`
      );
      if (action.id === "leader_guide") markChecklistComplete("leader-guide");
      if (action.id === "slide_plan") markChecklistComplete("slides");
      if (action.id === "small_group_questions") markChecklistComplete("questions");
    } catch (error) {
      setActionStatus(error instanceof Error ? error.message : "Generation failed safely.");
    } finally {
      setGenerating(null);
    }
  }

  function toggleChecklist(id: string) {
    if (readOnly) return;
    setChecklist((current) => current.map((item) => (item.id === id ? { ...item, complete: !item.complete } : item)));
  }

  function markChecklistComplete(id: string) {
    setChecklist((current) => current.map((item) => (item.id === id ? { ...item, complete: true } : item)));
  }

  async function askEmma(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) {
      setActionStatus("AI generation is disabled in guest mode. Available after sign-in.");
      return;
    }
    const prompt = emmaPrompt.trim();
    if (!prompt) return;
    const userMessage: EmmaChatMessage = { id: `user-${Date.now()}`, role: "user", content: prompt };
    setEmmaMessages((current) => [...current, userMessage]);
    setEmmaPrompt("");
    setEmmaLoading(true);
    try {
      const response = await fetch("/api/ai/emma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          page: "leader_prep",
          prompt: buildEmmaPrompt(prompt)
        })
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        provider?: string;
        model?: string;
        response?: { summary: string; points: string[]; nextActions: string[] };
      };
      if (!response.ok || !payload.response) throw new Error(payload.error ?? "EMMA could not answer right now.");
      const emmaResponse = payload.response;
      setEmmaMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: formatEmmaResponse(emmaResponse),
          sources: [
            `Sermon draft: ${title || "Untitled sermon"}`,
            `Scripture reference: ${passage || "Not selected"}`,
            `Meridian/EMMA provider: ${payload.provider ?? "deterministic"}${payload.model ? ` (${payload.model})` : ""}`
          ]
        }
      ]);
    } catch (error) {
      setEmmaMessages((current) => [
        ...current,
        {
          id: `assistant-error-${Date.now()}`,
          role: "assistant",
          content: error instanceof Error ? error.message : "EMMA could not answer right now."
        }
      ]);
    } finally {
      setEmmaLoading(false);
    }
  }

  function buildEmmaPrompt(prompt: string) {
    return [
      `User request: ${prompt}`,
      "",
      "Sermon prep context:",
      `Title: ${title || "Untitled sermon"}`,
      `Scripture: ${passage || "Not selected"}`,
      `Big idea: ${bigIdea || "Not written"}`,
      `Draft excerpt: ${body.slice(0, 900) || "No draft body yet."}`,
      "",
      "Answer directly with usable sermon-prep content. Cite the sermon draft, selected Scripture reference, and Meridian ministry context you used."
    ].join("\n");
  }

  return (
    <section className="leader-prep-page" aria-label="Leader Preparation workspace">
      <section className="leader-prep-mobile-command" aria-label="Leader prep priority">
        <div>
          <p className="eyebrow">Start here</p>
          <strong>{nextChecklistItem ? nextChecklistItem.label : "Ready for Sunday"}</strong>
          <span>{readerLink.ok ? `${readerLink.displayReference} is ready in YouVersion.` : readerLink.message}</span>
        </div>
        <div className="leader-prep-mobile-command-actions">
          <button type="button" onClick={() => runGenerateAction(guideAction)} disabled={generating !== null}>
            <FileText aria-hidden="true" />
            Guide
          </button>
          <button type="button" onClick={() => runGenerateAction(questionsAction)} disabled={generating !== null}>
            <MessageSquareText aria-hidden="true" />
            Questions
          </button>
          {readerLink.ok ? (
            <a href={readerLink.url} target="_blank" rel="noreferrer">
              <BookOpen aria-hidden="true" />
              Bible
            </a>
          ) : null}
        </div>
      </section>

      <div className="leader-prep-layout">
        <article className="leader-prep-editor" aria-labelledby="leader-prep-editor-title">
          <header className="leader-prep-editor-header">
            <div>
              <p className="eyebrow">Sermon Draft</p>
              <h2 id="leader-prep-editor-title">Draft workspace</h2>
            </div>
            <button className="leader-prep-save-button" type="button" onClick={saveDraft} disabled={readOnly}>
              <Save aria-hidden="true" />
              Save sermon
            </button>
          </header>

          <div className="leader-prep-editor-body">
            <div className="leader-prep-title-field">
              <input aria-label="Sermon title" value={title} readOnly={readOnly} onChange={(event) => markDraftChanged(setTitle, event.target.value)} />
            </div>

            <div className="leader-prep-meta-row">
              <input aria-label="Scripture passage" value={passage} readOnly={readOnly} onChange={(event) => markDraftChanged(setPassage, event.target.value)} />
              <span>{bigIdea.split(".")[0]}</span>
            </div>

            <label className="leader-prep-big-idea">
              <span>Big Idea</span>
              <textarea value={bigIdea} readOnly={readOnly} onChange={(event) => markDraftChanged(setBigIdea, event.target.value)} rows={2} />
            </label>

            {guestSeed ? <label className="leader-prep-big-idea">
              <span>Theological guardrail</span>
              <textarea value={competitionGuestSermon.theologicalGuardrail} readOnly rows={2} />
            </label> : null}

            <div className="leader-prep-body-field">
              <textarea aria-label="Sermon body" value={body} readOnly={readOnly} onChange={(event) => markDraftChanged(setBody, event.target.value)} />
            </div>
          </div>

          <footer className="leader-prep-actions">
            <p className="leader-prep-status" role="status">{draftStatus}</p>
            {prepActions.map((action) => (
              <button className={`leader-prep-action ${action.tone}`} key={action.id} type="button" disabled={generating !== null} onClick={() => runGenerateAction(action)}>
                {generating === action.id ? <LoaderCircle className="leader-prep-spin" aria-hidden="true" /> : action.id === "outline" ? <ListChecks aria-hidden="true" /> : action.id === "small_group_questions" ? <MessageSquareText aria-hidden="true" /> : <FileText aria-hidden="true" />}
                {generating === action.id ? "Generating..." : action.label}
              </button>
            ))}
            <p className="leader-prep-status" role="status">{actionStatus}</p>
            {generatedResources.length ? (
              <div className="leader-prep-generated-list" aria-label="Generated sermon resources">
                {generatedResources.map((resource) => (
                  <details key={resource.title}>
                    <summary>{resource.title}</summary>
                    <p>{resource.summary}</p>
                    <pre>{resource.contentMarkdown}</pre>
                    <small>{formatMeridianDiagnostics(resource)}</small>
                  </details>
                ))}
              </div>
            ) : null}
            {guestSeed ? <div className="leader-prep-generated-list" aria-label="Connected leader resources">
              <strong>Connected leader resources</strong>
              <div className="resource-list">
                {competitionLeaderResources.map((resource) => <article className="resource-card" key={resource.title}>
                  <div className="resource-card-main">
                    <div className="resource-card-title-row"><strong>{resource.title}</strong></div>
                    <p>{resource.detail}</p>
                  </div>
                  <div className="resource-card-actions">
                    {resource.href ? <a className="button compact-button" href={resource.href} target="_blank" rel="noreferrer" download={resource.title === "Sermon Slides" ? true : undefined}>
                      {resource.title === "Sermon Slides" ? "Open or download" : "Open audio"}
                    </a> : <span className="pill">Included in sermon prep</span>}
                  </div>
                </article>)}
              </div>
            </div> : null}
          </footer>
        </article>

        <aside className="leader-prep-rail" aria-label="Leader preparation side rail">
          <section className="leader-prep-youversion" aria-label="Scripture reference tools">
            <label className="leader-prep-reader-field">
              <span><BookOpen aria-hidden="true" /> Reader scripture</span>
              <input value={passage} readOnly={readOnly} onChange={(event) => markDraftChanged(setPassage, event.target.value)} />
            </label>
            <YouVersionReaderWindow link={readerLink.ok ? readerLink : undefined} title={passage || "Enter a passage"} />
          </section>

          <section className="leader-prep-emma-card" aria-label="Ask EMMA preparation assistant">
            <button type="button" aria-expanded={emmaOpen} aria-controls="leader-prep-emma-popover" onClick={() => readOnly ? setActionStatus("AI generation is disabled in guest mode. Available after sign-in.") : setEmmaOpen(true)}>
              <span aria-hidden="true"><Sparkles /></span>
              <span>
                <small>Ask EMMA</small>
                <strong>Draft with me</strong>
                <em>{emmaMessages.at(-1)?.content ?? "Ask for sermon prep help."}</em>
              </span>
            </button>
            {emmaOpen ? (
              <div className="leader-prep-emma-popover" id="leader-prep-emma-popover" role="dialog" aria-modal="false" aria-label="Ask EMMA">
                <div className="leader-prep-emma-popover-head">
                  <div>
                    <p className="eyebrow">EMMA</p>
                    <h3>Ask anything</h3>
                  </div>
                  <button type="button" aria-label="Close Ask EMMA" onClick={() => setEmmaOpen(false)}>
                    <X aria-hidden="true" />
                  </button>
                </div>
                <form onSubmit={askEmma}>
                  <div className="leader-prep-emma-thread" aria-live="polite">
                    {emmaMessages.map((message) => (
                      <div className={message.role === "user" ? "leader-prep-emma-message user" : "leader-prep-emma-message"} key={message.id}>
                        <strong>{message.role === "user" ? "You" : "EMMA"}</strong>
                        <p>{message.content}</p>
                        {message.sources?.length ? <small>Sources: {message.sources.join("; ")}</small> : null}
                      </div>
                    ))}
                    {emmaLoading ? <p className="leader-prep-emma-thinking"><LoaderCircle className="leader-prep-spin" aria-hidden="true" />EMMA is drafting...</p> : null}
                  </div>
                  <label>
                    <span className="sr-only">Message EMMA</span>
                    <textarea value={emmaPrompt} onChange={(event) => setEmmaPrompt(event.target.value)} rows={3} />
                  </label>
                  <button type="submit" disabled={emmaLoading}>
                    {emmaLoading ? <LoaderCircle className="leader-prep-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
                    {emmaLoading ? "Asking..." : "Ask EMMA"}
                  </button>
                </form>
              </div>
            ) : null}
          </section>

          <section className="leader-prep-checklist" aria-labelledby="leader-prep-checklist-title">
            <p className="eyebrow">Prep</p>
            <h3 id="leader-prep-checklist-title">Before Sunday</h3>
            <div className="leader-prep-checklist-items">
              {checklist.map((item) => (
                <label className={item.complete ? "complete" : ""} key={item.id}>
                  <input type="checkbox" checked={item.complete} disabled={readOnly} onChange={() => toggleChecklist(item.id)} />
                  <span aria-hidden="true">{item.complete ? <Check /> : null}</span>
                  {item.label}
                </label>
              ))}
            </div>
            <p>{completeCount} of {checklist.length} ready</p>
          </section>
        </aside>
      </div>
    </section>
  );
}

function formatEmmaResponse(response: { summary: string; points: string[]; nextActions: string[] }) {
  return [
    response.summary,
    ...response.points.map((point) => `- ${point}`),
    ...response.nextActions.map((action) => `Next: ${action}`)
  ].join("\n");
}

function formatMeridianDiagnostics(resource: GeneratedResource) {
  const provenance = resource.provenance;
  if (!provenance) return `Diagnostics: provider ${resource.provider}; sources ${resource.sources.join("; ")}`;
  const sourceCount = provenance.selectedSourceIds.length;
  return [
    `Diagnostics: Meridian ${provenance.meridianRan ? "used" : "skipped"}`,
    `provider ${provenance.aiProvider || resource.provider}`,
    `model ${provenance.model || resource.model || "unknown"}`,
    `${sourceCount} selected source${sourceCount === 1 ? "" : "s"}`,
    `types ${provenance.selectedSourceTypes.join(", ") || "none"}`,
    `fallback ${provenance.fallbackUsed ? "yes" : "no"}`,
    `validation ${provenance.validationResult}`
  ].join("; ");
}
