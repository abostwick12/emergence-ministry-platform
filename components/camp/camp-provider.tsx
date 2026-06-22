"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { deriveCampDays, scheduleForDay, type CampDay } from "@/lib/camp/days";
import type { CampOverviewPayload, CampScheduleBlock } from "@/lib/camp/types";

export type CampHomeMode = "operations" | "medical";

export type CampCapabilities = {
  restrictedMedical: boolean;
  medicalCommand: boolean;
};

export type { CampDay };

type CampOverviewResponse = CampOverviewPayload & { capabilities?: CampCapabilities };

const emptyOverview: CampOverviewPayload = {
  campName: "",
  campStartsOn: "",
  teams: [],
  vehicles: [],
  schedule: [],
  documents: [],
  students: [],
  staff: []
};

const emptyCapabilities: CampCapabilities = { restrictedMedical: false, medicalCommand: false };

type CampContextValue = {
  overview: CampOverviewPayload;
  capabilities: CampCapabilities;
  loading: boolean;
  days: CampDay[];
  selectedDay: string;
  setSelectedDay: (key: string) => void;
  scheduleForSelectedDay: CampScheduleBlock[];
  homeMode: CampHomeMode;
  setHomeMode: (mode: CampHomeMode) => void;
  refresh: () => Promise<void>;
};

const CampContext = createContext<CampContextValue | null>(null);

export function CampProvider({ children }: { children: React.ReactNode }) {
  const [overview, setOverview] = useState<CampOverviewPayload>(emptyOverview);
  const [capabilities, setCapabilities] = useState<CampCapabilities>(emptyCapabilities);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState("");
  const [homeMode, setHomeMode] = useState<CampHomeMode>("operations");

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/camp", { cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as CampOverviewResponse;
        setOverview(payload);
        setCapabilities(payload.capabilities ?? emptyCapabilities);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const days = useMemo(() => deriveCampDays(overview.schedule, overview.campStartsOn), [overview.schedule, overview.campStartsOn]);

  // Keep the selected day valid as data loads or the schedule changes.
  useEffect(() => {
    if (!days.length) return;
    if (!days.some((day) => day.key === selectedDay)) {
      setSelectedDay(days[0].key);
    }
  }, [days, selectedDay]);

  const scheduleForSelectedDay = useMemo(
    () => scheduleForDay(overview.schedule, selectedDay),
    [overview.schedule, selectedDay]
  );

  useEffect(() => {
    if (!capabilities.medicalCommand && homeMode === "medical") setHomeMode("operations");
  }, [capabilities.medicalCommand, homeMode]);

  const value = useMemo<CampContextValue>(
    () => ({
      overview,
      capabilities,
      loading,
      days,
      selectedDay,
      setSelectedDay,
      scheduleForSelectedDay,
      homeMode,
      setHomeMode,
      refresh
    }),
    [overview, capabilities, loading, days, selectedDay, scheduleForSelectedDay, homeMode, refresh]
  );

  return <CampContext.Provider value={value}>{children}</CampContext.Provider>;
}

export function useCamp(): CampContextValue {
  const ctx = useContext(CampContext);
  if (!ctx) throw new Error("useCamp must be used within a CampProvider");
  return ctx;
}
