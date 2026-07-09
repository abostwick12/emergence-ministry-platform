"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

type MobileNavContextValue = {
  open: boolean;
  toggle: () => void;
  close: () => void;
};

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

export function CommandCenterMobileNavProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <MobileNavContext.Provider value={{ open, toggle: () => setOpen((value) => !value), close: () => setOpen(false) }}>
      {children}
    </MobileNavContext.Provider>
  );
}

function useCommandCenterMobileNav(): MobileNavContextValue {
  const ctx = useContext(MobileNavContext);
  if (!ctx) throw new Error("useCommandCenterMobileNav must be used within CommandCenterMobileNavProvider");
  return ctx;
}

export function CommandCenterMenuToggle() {
  const { open, toggle } = useCommandCenterMobileNav();
  return (
    <button className="cc-button cc-menu-toggle" type="button" onClick={toggle} aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open}>
      {open ? <X size={16} /> : <Menu size={16} />}
    </button>
  );
}

export function CommandCenterSidebarBackdrop() {
  const { open, close } = useCommandCenterMobileNav();
  return <div className={`cc-sidebar-backdrop${open ? " cc-visible" : ""}`} onClick={close} aria-hidden="true" />;
}

export function useCommandCenterSidebarOpen(): { open: boolean; close: () => void } {
  const { open, close } = useCommandCenterMobileNav();
  return { open, close };
}
