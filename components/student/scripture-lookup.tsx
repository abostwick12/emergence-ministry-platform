"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { YouVersionReaderWindow } from "@/components/student/youversion-reader-window";
import { buildYouVersionReaderLink, type YouVersionReaderLink } from "@/lib/scripture/youversion";

type LookupState =
  | { status: "idle"; message: string }
  | {
      status: "success";
      message: string;
      reader: YouVersionReaderLink;
      passage?: { content: string; reference: string };
    }
  | { status: "error"; message: string };

type LookupResponse =
  | { ok: true; passage: { content: string; reference: string }; passageId: string }
  | { ok: false; code?: string; error?: string };

const initialState: LookupState = {
  status: "idle",
  message: "No passage is open yet. Choose a reference to open the Bible App reader."
};

export function ScriptureLookup({ initialReference = "" }: { initialReference?: string }) {
  const normalizedInitialReference = initialReference.trim();
  const hasRunInitialLookup = useRef(false);
  const [reference, setReference] = useState(normalizedInitialReference);
  const [state, setState] = useState<LookupState>(initialState);

  const runLookup = useCallback(async (requestedReference: string) => {
    const reader = buildYouVersionReaderLink(requestedReference);
    if (!reader.ok) {
      setState({ status: "error", message: reader.message });
      return;
    }

    setState({ status: "idle", message: "Resolving the passage through YouVersion Platform..." });
    try {
      const response = await fetch("/api/student/scripture/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference: requestedReference })
      });
      const payload = (await response.json()) as LookupResponse;
      if (response.ok && payload.ok) {
        setState({
          status: "success",
          message: "Bible App reader opened. YouVersion Platform returned the passage text.",
          reader,
          passage: payload.passage
        });
        return;
      }

      setState({
        status: "success",
        message: `Bible App reader opened. ${payload.ok ? "" : payload.error ?? "Live passage text is unavailable."}`.trim(),
        reader
      });
    } catch {
      setState({
        status: "success",
        message: "Bible App reader opened. Live passage text is temporarily unavailable.",
        reader
      });
    }
  }, []);

  useEffect(() => {
    if (!normalizedInitialReference || hasRunInitialLookup.current) return;
    hasRunInitialLookup.current = true;
    void runLookup(normalizedInitialReference);
  }, [normalizedInitialReference, runLookup]);

  function submitLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void runLookup(reference.trim());
  }

  return (
    <section className="panel scripture-lookup" aria-label="Scripture lookup">
      <div className="grid gap-2">
        <p className="eyebrow">YouVersion reader</p>
        <h2 className="section-title flush">Open Scripture without leaving the journey.</h2>
        <p className="scripture-provider-boundary">
          Judged provider step: Lead Emergence resolves the reference server-side and opens YouVersion surfaces. Meridian stores references and relationships, not Bible text.
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
          <button className="button primary min-h-11" type="submit">
            <Search aria-hidden="true" size={16} />
            Open Reader
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

      {state.status === "success" && state.passage ? (
        <article className="scripture-builder-preview-card" aria-label="YouVersion passage result">
          <p className="eyebrow">YouVersion Platform API</p>
          <h3>{state.passage.reference}</h3>
          <p>{state.passage.content}</p>
          <small>Scripture text supplied at request time by YouVersion Platform (BSB, Bible 3034). Lead Emergence does not add it to Meridian memory.</small>
        </article>
      ) : null}

      <YouVersionReaderWindow link={state.status === "success" ? state.reader : undefined} />
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
