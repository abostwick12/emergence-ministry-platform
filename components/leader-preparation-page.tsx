"use client";

import { FormEvent, useMemo, useState } from "react";
import { BookOpen, Check, ExternalLink, FileText, ListChecks, Mic2, Send, Sparkles, X } from "lucide-react";

import { buildYouVersionReaderLink } from "@/lib/scripture/youversion";

type PrepAction = {
  id: "outline" | "guide" | "slides" | "audio";
  label: string;
  tone: "cyan" | "gold";
};

const prepActions: PrepAction[] = [
  { id: "outline", label: "Generate outline", tone: "cyan" },
  { id: "guide", label: "Generate leader guide", tone: "cyan" },
  { id: "slides", label: "Generate Canva slides", tone: "gold" },
  { id: "audio", label: "Generate audio summary", tone: "gold" }
];

const initialChecklist = [
  { id: "big-idea", label: "Big idea named", complete: true },
  { id: "leader-guide", label: "Leader guide sent", complete: true },
  { id: "slides", label: "Slides in Canva", complete: false },
  { id: "audio", label: "Audio summary posted", complete: false },
  { id: "prayer", label: "Prayer request written", complete: false }
];

const samplePassage = [
  "It was just before the Passover Festival. Jesus knew that the hour had come for him to leave this world and go to the Father...",
  "so he got up from the meal, took off his outer clothing, and wrapped a towel around his waist..."
];

export function LeaderPreparationPage() {
  const [title, setTitle] = useState("When the King Kneels");
  const [passage, setPassage] = useState("John 13:1-17");
  const [bigIdea, setBigIdea] = useState("Real authority stoops. If Jesus is Lord, then love looks like a towel, not a title.");
  const [body, setBody] = useState(
    "Jesus knew where he came from and where he was going, and out of that grounded identity he picked up a towel.\n\n" +
      "We usually think power protects us from the low place. In the upper room, love takes Jesus toward it.\n\n" +
      "Notice the timing: this happens right before betrayal, denial, and the cross. Jesus isn't rewarding the disciples. He is showing them what the whole kingdom looks like from the inside.\n\n" +
      "Peter's response - \"You shall never wash my feet\" - sounds humble, but it's actually resistance. To follow Jesus is to receive from him before you serve like him.\n\n" +
      "Where in your week are you refusing the towel - either to receive it or to pick it up?"
  );
  const [checklist, setChecklist] = useState(initialChecklist);
  const [actionStatus, setActionStatus] = useState("Draft autosaved locally. Generation actions are preview-only.");
  const [emmaOpen, setEmmaOpen] = useState(false);
  const [emmaPrompt, setEmmaPrompt] = useState("Give me two leader discussion questions from this big idea.");
  const [emmaResponse, setEmmaResponse] = useState("Ask for illustrations, discussion questions, or a leader-facing rewrite in your voice.");

  const readerLink = useMemo(() => buildYouVersionReaderLink(passage), [passage]);
  const completeCount = checklist.filter((item) => item.complete).length;
  const nextChecklistItem = checklist.find((item) => !item.complete);
  const guideAction: PrepAction = prepActions.find((action) => action.id === "guide") ?? { id: "guide", label: "Generate leader guide", tone: "cyan" };
  const audioAction: PrepAction = prepActions.find((action) => action.id === "audio") ?? { id: "audio", label: "Generate audio summary", tone: "gold" };

  function runPreviewAction(action: PrepAction) {
    const target = action.id === "slides" ? "Canva slide" : action.id === "audio" ? "audio summary" : action.label.replace("Generate ", "");
    setActionStatus(`${target[0].toUpperCase()}${target.slice(1)} preview staged. No live Canva, audio, AI, or sending action was run.`);
  }

  function toggleChecklist(id: string) {
    setChecklist((current) => current.map((item) => (item.id === id ? { ...item, complete: !item.complete } : item)));
  }

  function askEmma(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = emmaPrompt.trim();
    if (!prompt) return;
    setEmmaResponse(
      `Preview response: shape this around "${bigIdea}" and give leaders one observation question, one heart question, and one practice step. No live EMMA request was sent.`
    );
    setEmmaPrompt("");
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
          <button type="button" onClick={() => runPreviewAction(guideAction)}>
            <FileText aria-hidden="true" />
            Guide
          </button>
          <button type="button" onClick={() => runPreviewAction(audioAction)}>
            <Mic2 aria-hidden="true" />
            Audio
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
            <span>Autosaved locally</span>
          </header>

          <div className="leader-prep-editor-body">
            <div className="leader-prep-title-field">
              <textarea aria-label="Sermon title" value={title} onChange={(event) => setTitle(event.target.value)} rows={2} />
            </div>

            <div className="leader-prep-meta-row">
              <input aria-label="Scripture passage" value={passage} onChange={(event) => setPassage(event.target.value)} />
              <span>{bigIdea.split(".")[0]}</span>
            </div>

            <label className="leader-prep-big-idea">
              <span>Big Idea</span>
              <textarea value={bigIdea} onChange={(event) => setBigIdea(event.target.value)} rows={2} />
            </label>

            <div className="leader-prep-body-field">
              <textarea aria-label="Sermon body" value={body} onChange={(event) => setBody(event.target.value)} />
            </div>
          </div>

          <footer className="leader-prep-actions">
            {prepActions.map((action) => (
              <button className={`leader-prep-action ${action.tone}`} key={action.id} type="button" onClick={() => runPreviewAction(action)}>
                {action.id === "outline" ? <ListChecks aria-hidden="true" /> : action.id === "audio" ? <Mic2 aria-hidden="true" /> : <FileText aria-hidden="true" />}
                {action.label}
              </button>
            ))}
            <p className="leader-prep-status" role="status">{actionStatus}</p>
          </footer>
        </article>

        <aside className="leader-prep-rail" aria-label="Leader preparation side rail">
          <section className="leader-prep-youversion" aria-label="YouVersion Bible reader">
            <header>
              <p className="eyebrow">
                <BookOpen aria-hidden="true" />
                YouVersion
              </p>
              {readerLink.ok ? (
                <a href={readerLink.url} target="_blank" rel="noreferrer">
                  <ExternalLink aria-hidden="true" />
                  Open
                </a>
              ) : null}
            </header>
            <div className="leader-prep-bible-card">
              <span>Bible App - NIV</span>
              <strong>{readerLink.ok ? readerLink.displayReference : passage || "Enter a passage"}</strong>
              {readerLink.ok ? (
                samplePassage.map((line) => <p key={line}>{line}</p>)
              ) : (
                <p>{readerLink.message}</p>
              )}
            </div>
          </section>

          <section className="leader-prep-emma-card" aria-label="Ask EMMA preparation assistant">
            <button type="button" aria-expanded={emmaOpen} aria-controls="leader-prep-emma-popover" onClick={() => setEmmaOpen(true)}>
              <span aria-hidden="true"><Sparkles /></span>
              <span>
                <small>Ask EMMA</small>
                <strong>Draft with me</strong>
                <em>{emmaResponse}</em>
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
                  <label>
                    <span className="sr-only">Message EMMA</span>
                    <textarea value={emmaPrompt} onChange={(event) => setEmmaPrompt(event.target.value)} rows={4} />
                  </label>
                  <button type="submit">
                    <Send aria-hidden="true" />
                    Ask EMMA
                  </button>
                </form>
                <p role="status">{emmaResponse}</p>
              </div>
            ) : null}
          </section>

          <section className="leader-prep-checklist" aria-labelledby="leader-prep-checklist-title">
            <p className="eyebrow">Prep</p>
            <h3 id="leader-prep-checklist-title">Before Sunday</h3>
            <div className="leader-prep-checklist-items">
              {checklist.map((item) => (
                <label className={item.complete ? "complete" : ""} key={item.id}>
                  <input type="checkbox" checked={item.complete} onChange={() => toggleChecklist(item.id)} />
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
