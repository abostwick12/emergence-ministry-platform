"use client";

import { ExternalLink } from "lucide-react";

import type { YouVersionReaderLink } from "@/lib/scripture/youversion";

type YouVersionReaderWindowProps = {
  link?: YouVersionReaderLink;
  title?: string;
};

export function YouVersionReaderWindow({ link, title = "Bible App reader" }: YouVersionReaderWindowProps) {
  if (!link?.ok) {
    return (
      <div className="youversion-reader-window empty">
        <p className="eyebrow">YouVersion Reader</p>
        <h4>{title}</h4>
      </div>
    );
  }

  return (
    <section className="youversion-reader-window" aria-label="YouVersion Bible reader">
      <div className="youversion-reader-window-heading">
        <div>
          <p className="eyebrow">YouVersion Reader</p>
          <h4>{link.displayReference}</h4>
        </div>
        <a className="button compact" href={link.url} rel="noreferrer" target="_blank">
          <ExternalLink aria-hidden="true" size={15} />
          Open
        </a>
      </div>
      <div className="youversion-reader-frame-wrap">
        <iframe
          className="youversion-reader-frame"
          referrerPolicy="strict-origin-when-cross-origin"
          src={link.url}
          title={`YouVersion reader for ${link.displayReference}`}
        />
      </div>
      <p className="youversion-reader-note">Open in YouVersion for sign-in, audio, notes, and highlights.</p>
      <p className="youversion-reader-note provider-boundary">
        Provider boundary: YouVersion supplies canonical Scripture surfaces; Lead Emergence keeps only the approved reference context for Meridian retrieval.
      </p>
    </section>
  );
}
