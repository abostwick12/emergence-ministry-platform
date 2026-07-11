"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type LookupState =
  | { status: "idle"; message: string }
  | { status: "loading"; message: string }
  | { status: "success"; message: string; passage: { id: string; reference: string; content: string } }
  | { status: "error"; message: string };

const initialState: LookupState = {
  status: "idle",
  message: "No lookup has run yet. Returned Bible text is shown only on this page and is not saved."
};

export function ScriptureLookup({ initialReference = "" }: { initialReference?: string }) {
  const normalizedInitialReference = initialReference.trim();
  const hasRunInitialLookup = useRef(false);
  const [reference, setReference] = useState(normalizedInitialReference);
  const [state, setState] = useState<LookupState>(initialState);

  const runLookup = useCallback(async (requestedReference: string) => {
    if (!requestedReference) {
      setState({ status: "error", message: "Enter a Scripture reference first." });
      return;
    }

    setState({ status: "loading", message: "Looking up Scripture..." });

    try {
      const response = await fetch("/api/student/scripture/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: requestedReference })
      });
      const payload = await response.json() as {
        ok?: boolean;
        error?: string;
        passage?: { id?: string; reference?: string; content?: string };
      };

      if (!response.ok || !payload.ok || !payload.passage?.content || !payload.passage.reference || !payload.passage.id) {
        setState({ status: "error", message: payload.error ?? "Scripture lookup is temporarily unavailable." });
        return;
      }

      setState({
        status: "success",
        message: "Scripture lookup loaded.",
        passage: {
          id: payload.passage.id,
          reference: payload.passage.reference,
          content: payload.passage.content
        }
      });
    } catch {
      setState({ status: "error", message: "Scripture lookup is temporarily unavailable." });
    }
  }, []);

  useEffect(() => {
    if (!normalizedInitialReference || hasRunInitialLookup.current) return;
    hasRunInitialLookup.current = true;
    void runLookup(normalizedInitialReference);
  }, [normalizedInitialReference, runLookup]);

  async function submitLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runLookup(reference.trim());
  }

  return (
    <section className="panel scripture-lookup" aria-label="Scripture lookup">
      <div className="grid gap-2">
        <p className="eyebrow">YouVersion lookup</p>
        <h2 className="section-title flush">Look up a Scripture reference</h2>
        <p className="scripture-builder-copy">
          Enter a chapter or verse reference to read it here through the server. This does not save Bible text, create history,
          link accounts, send messages, or use AI.
        </p>
      </div>

      <form className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]" onSubmit={submitLookup}>
        <label className="field">
          <span>Scripture reference</span>
          <input
            className="input"
            name="reference"
            onChange={(event) => setReference(event.target.value)}
            placeholder="John 3:16"
            type="text"
            value={reference}
          />
        </label>
        <div className="flex items-end">
          <button className="button primary min-h-11" disabled={state.status === "loading"} type="submit">
            {state.status === "loading" ? "Looking up..." : "Look Up"}
          </button>
        </div>
      </form>

      <div
        className={statusClassName(state.status)}
        role={state.status === "success" ? "status" : "alert"}
        aria-live="polite"
      >
        <p>{state.message}</p>
      </div>

      {state.status === "success" ? (
        <article className="scripture-lookup-result" aria-label="Scripture lookup result">
          <div>
            <p className="eyebrow">Lookup result</p>
            <h3>{state.passage.reference}</h3>
          </div>
          <p className="scripture-lookup-content">{state.passage.content}</p>
          <p className="scripture-lookup-id">Passage ID: {state.passage.id}</p>
        </article>
      ) : null}
    </section>
  );
}

function statusClassName(status: LookupState["status"]) {
  if (status === "success") {
    return "scripture-lookup-status success";
  }

  if (status === "error") {
    return "scripture-lookup-status warning";
  }

  return "scripture-lookup-status";
}
