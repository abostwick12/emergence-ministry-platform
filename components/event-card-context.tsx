"use client";

import { createContext, useCallback, useContext, useState } from "react";

type EventCardMode = "create" | "edit";

interface EventCardState {
  isOpen: boolean;
  mode: EventCardMode;
  eventId?: string;
  savedAt: number;
}

interface EventCardContextValue {
  state: EventCardState;
  canSaveChanges: boolean;
  openCreate: () => void;
  openEdit: (eventId: string) => void;
  close: () => void;
  notifySaved: () => void;
}

const EventCardContext = createContext<EventCardContextValue | null>(null);

export function useEventCard() {
  const ctx = useContext(EventCardContext);
  if (!ctx) throw new Error("useEventCard must be used inside EventCardProvider");
  return ctx;
}

export function EventCardProvider({ children, canSaveChanges = true }: { children: React.ReactNode; canSaveChanges?: boolean }) {
  const [state, setState] = useState<EventCardState>({ isOpen: false, mode: "create", savedAt: 0 });

  const openCreate = useCallback(() => {
    if (!canSaveChanges) return;
    setState((prev) => ({ ...prev, isOpen: true, mode: "create", eventId: undefined }));
  }, [canSaveChanges]);

  const openEdit = useCallback((eventId: string) => {
    setState((prev) => ({ ...prev, isOpen: true, mode: "edit", eventId }));
  }, []);

  const close = useCallback(() => {
    setState((current) => ({ ...current, isOpen: false }));
  }, []);

  const notifySaved = useCallback(() => {
    setState((current) => ({ ...current, savedAt: current.savedAt + 1 }));
  }, []);

  return (
    <EventCardContext.Provider value={{ state, canSaveChanges, openCreate, openEdit, close, notifySaved }}>
      {children}
    </EventCardContext.Provider>
  );
}
