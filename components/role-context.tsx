"use client";

import { createContext, useContext, useMemo, useState } from "react";
import type { Role } from "@/lib/types";

type RoleContextValue = {
  activeRole: Role;
  setActiveRole: (role: Role) => void;
};

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [activeRole, setActiveRole] = useState<Role>("admin");
  const value = useMemo(() => ({ activeRole, setActiveRole }), [activeRole]);

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const value = useContext(RoleContext);
  if (!value) {
    throw new Error("useRole must be used inside RoleProvider");
  }

  return value;
}
