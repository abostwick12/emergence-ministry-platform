"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";

import { YouVersionReaderWindow } from "@/components/student/youversion-reader-window";
import { buildYouVersionReaderLink, type YouVersionReaderLink } from "@/lib/scripture/youversion";

type LookupState =
  | { status: "idle"; message: string }
  | { status: "success"; message: string; reader: YouVersionReaderLink }
  | { status: "error"; message: string };

const initialState: LookupState = {
  status: "idle",
  message: "No passage is open yet. Choose a reference to open the Bible App reader."
};

export function ScriptureLookup({ initialReference = "" }: { initialReference?: string }) {
  const normalizedInitialReference = initialReference.trim();
  const hasRunInitialLookup = useRef(false);
  const [reference, setReference] = useState(normalizedInitialReference);
  const [state, setState] = useState<LookupState>(initialState);

  const runLookup = useCallback((requestedReference: string) => {
    const reader = buildYouVersionReaderLink(requestedReference);
    if (reader.ok) {
      setState({
        status: "success",
        message: "Bible App reader opened.",
        reader
      });
      return;
    }

    setState({ status: "error", message: reader.message });
  }, []);

  useEffect(() => {
    if (!normalizedInitialReference || hasRunInitialLookup.current) return;
    hasRunInitialLookup.current = true;
    runLookup(normalizedInitialReference);
  }, [normalizedInitialReference, runLookup]);

  function submitLookup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runLookup(reference.trim());
  }

  return (
    <section className="panel scripture-lookup" aria-label="Scripture lookup">
      <div className="grid gap-2">
        <p className="eyebrow">YouVersion reader</p>
        <h2 className="section-title flush">Open Scripture without leaving the journey.</h2>
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
