"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { getDefaultCampAccessScope } from "@/lib/camp/access";
import { deriveCampDays, scheduleForDay, type CampDay } from "@/lib/camp/days";
import type { CampAccessRole, CampOverviewPayload, CampScheduleBlock } from "@/lib/camp/types";

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
  students: []
};

const emptyCapabilities: CampCapabilities = { restrictedMedical: false, medicalCommand: false };

type CampContextValue = {
  role: CampAccessRole;
  setRole: (role: CampAccessRole) => void;
  driverVehicleId: string;
  setDriverVehicleId: (id: string) => void;
  overview: CampOverviewPayload;
  capabilities: CampCapabilities;
  loading: boolean;
  days: CampDay[];
  selectedDay: string;
  setSelectedDay: (key: string) => void;
  scheduleForSelectedDay: CampScheduleBlock[];
  refresh: () => Promise<void>;
};

const CampContext = createContext<CampContextValue | null>(null);

export function CampProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<CampAccessRole>("general_leader");
  const [driverVehicleId, setDriverVehicleId] = useState(getDefaultCampAccessScope("driver").vehicleId ?? "van-2");
  const [overview, setOverview] = useState<CampOverviewPayload>(emptyOverview);
  const [capabilities, setCapabilities] = useState<CampCapabilities>(emptyCapabilities);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ role });
    if (role === "driver") params.set("vehicleId", driverVehicleId);
    try {
      const response = await fetch(`/api/camp?${params.toString()}`, { cache: "no-store" });
      if (response.ok) {
        const payload = (await response.json()) as CampOverviewResponse;
        setOverview(payload);
        setCapabilities(payload.capabilities ?? emptyCapabilities);
      }
    } finally {
      setLoading(false);
    }
  }, [role, driverVehicleId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const days = useMemo(() => deriveCampDays(overview.schedule), [overview.schedule]);

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

  const value = useMemo<CampContextValue>(
    () => ({
      role,
      setRole,
      driverVehicleId,
      setDriverVehicleId,
      overview,
      capabilities,
      loading,
      days,
      selectedDay,
      setSelectedDay,
      scheduleForSelectedDay,
      refresh
    }),
    [role, driverVehicleId, overview, capabilities, loading, days, selectedDay, scheduleForSelectedDay, refresh]
  );

  return <CampContext.Provider value={value}>{children}</CampContext.Provider>;
}

export function useCamp(): CampContextValue {
  const ctx = useContext(CampContext);
  if (!ctx) throw new Error("useCamp must be used within a CampProvider");
  return ctx;
}
