"use client";

import { createContext, useCallback, useContext, useState } from "react";

type EventCardMode = "create" | "edit";

interface EventCardState {
  isOpen: boolean;
  mode: EventCardMode;
  eventId?: string;
}

interface EventCardContextValue {
  state: EventCardState;
  openCreate: () => void;
  openEdit: (eventId: string) => void;
  close: () => void;
}

const EventCardContext = createContext<EventCardContextValue | null>(null);

export function useEventCard() {
  const ctx = useContext(EventCardContext);
  if (!ctx) throw new Error("useEventCard must be used inside EventCardProvider");
  return ctx;
}

export function EventCardProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<EventCardState>({ isOpen: false, mode: "create" });

  const openCreate = useCallback(() => {
    setState({ isOpen: true, mode: "create", eventId: undefined });
  }, []);

  const openEdit = useCallback((eventId: string) => {
    setState({ isOpen: true, mode: "edit", eventId });
  }, []);

  const close = useCallback(() => {
    setState((current) => ({ ...current, isOpen: false }));
  }, []);

  return (
    <EventCardContext.Provider value={{ state, openCreate, openEdit, close }}>
      {children}
    </EventCardContext.Provider>
  );
}
