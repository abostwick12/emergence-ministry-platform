"use client";

import { useEffect, useRef } from "react";

export function CampOperationDialog({
  title,
  description,
  children,
  footer,
  onClose
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus();
    };
  }, []);

  return (
    <div className="camp-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="camp-dialog" role="dialog" aria-modal="true" aria-labelledby="camp-dialog-title" ref={dialogRef} tabIndex={-1}>
        <header className="camp-dialog-head">
          <div>
            <h2 id="camp-dialog-title">{title}</h2>
            {description ? <p className="camp-cc-muted">{description}</p> : null}
          </div>
          <button className="button compact-button" type="button" aria-label="Close editor" onClick={onClose}>
            Close
          </button>
        </header>
        <div className="camp-dialog-body">{children}</div>
        {footer ? <footer className="camp-dialog-foot">{footer}</footer> : null}
      </section>
    </div>
  );
}
