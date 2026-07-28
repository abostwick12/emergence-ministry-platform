"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  BarChart3,
  BookOpen,
  Bot,
  CalendarPlus,
  GraduationCap,
  LayoutDashboard,
  Library,
  ListChecks,
  LogOut,
  Menu,
  MessageSquareText,
  NotebookPen,
  PanelsTopLeft,
  Plus,
  Settings,
  TentTree,
  Users,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { MinistryEmmaPanel } from "@/components/ministry-emma-panel";
import type { AppNavLink, MobilePortalSection } from "@/lib/app-shell-navigation";
import type { MinistryEmmaPage } from "@/lib/emma/ministry-page-assistant";

type MobileSheet = "actions" | "emma" | "more" | null;

const destinationIcons: Record<string, LucideIcon> = {
  "/dashboard": LayoutDashboard,
  "/ministry": PanelsTopLeft,
  "/events": CalendarPlus,
  "/tasks": ListChecks,
  "/communications": MessageSquareText,
  "/people": Users,
  "/student": GraduationCap,
  "/student/scripture/questions": NotebookPen,
  "/student/scripture/resources": BookOpen,
  "/student/scripture/plans": CalendarPlus,
  "/student/scripture/how-to-read": Library,
  "/directors": BarChart3,
  "/camp": TentTree,
  "/settings": Settings,
  "/command-center": Bot
};

const sectionIcons: Record<MobilePortalSection["id"], LucideIcon> = {
  ministry: PanelsTopLeft,
  volunteer: Users,
  student: GraduationCap,
  director: BarChart3,
  platform: Menu
};

export function MobileFieldControls({
  canManageEvents,
  isStudentShell,
  mobileLinks,
  onCreateEvent,
  pathname,
  portalSections
}: {
  canManageEvents: boolean;
  isStudentShell: boolean;
  mobileLinks: AppNavLink[];
  onCreateEvent: () => void;
  pathname: string;
  portalSections: MobilePortalSection[];
}) {
  const [activeSheet, setActiveSheet] = useState<MobileSheet>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const activePortal = portalSections.find((section) => sectionIsActive(pathname, section));
  const moreIsActive = !mobileLinks.some((link) => mobileLinkIsActive(pathname, link.href, isStudentShell));
  const availableHrefs = new Set(portalSections.flatMap((section) => section.links.map((link) => link.href)));
  const contextualLinks = activePortal?.links.filter((link) => !mobileLinks.some((mobileLink) => mobileLink.href === link.href)) ?? [];
  const platformLinks = portalSections.find((section) => section.id === "platform")?.links ?? [];

  useEffect(() => {
    setActiveSheet(null);
  }, [pathname]);

  useEffect(() => {
    if (!activeSheet) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setActiveSheet(null);
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      lastTriggerRef.current?.focus();
    };
  }, [activeSheet]);

  function openSheet(sheet: Exclude<MobileSheet, null>, trigger: HTMLButtonElement) {
    lastTriggerRef.current = trigger;
    setActiveSheet(sheet);
  }

  function closeSheet() {
    setActiveSheet(null);
  }

  return (
    <div className="mobile-field-controls">
      <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
        {mobileLinks.map((link) => {
          const Icon = destinationIcons[link.href] ?? LayoutDashboard;
          const active = mobileLinkIsActive(pathname, link.href, isStudentShell);
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={active ? "mobile-nav-link active" : "mobile-nav-link"}
              href={link.href}
              key={link.href}
            >
              <Icon aria-hidden="true" />
              <span>{link.label}</span>
            </Link>
          );
        })}
        <button
          aria-expanded={activeSheet === "actions"}
          className={activeSheet === "actions" ? "mobile-nav-link active" : "mobile-nav-link"}
          type="button"
          onClick={(event) => openSheet("actions", event.currentTarget)}
        >
          <Plus aria-hidden="true" />
          <span>Act</span>
        </button>
        <button
          aria-current={moreIsActive ? "page" : undefined}
          aria-expanded={activeSheet === "more"}
          className={moreIsActive || activeSheet === "more" ? "mobile-nav-link active" : "mobile-nav-link"}
          type="button"
          onClick={(event) => openSheet("more", event.currentTarget)}
        >
          <Menu aria-hidden="true" />
          <span>More</span>
        </button>
      </nav>

      {activeSheet ? (
        <div className="mobile-sheet-layer">
          <button className="mobile-sheet-backdrop" type="button" aria-label="Close mobile sheet" onClick={closeSheet} />
          <section
            aria-label={activeSheet === "emma" ? "Ask EMMA" : activeSheet === "actions" ? "Quick actions" : "More navigation"}
            aria-modal="true"
            className={activeSheet === "emma" ? "mobile-field-sheet mobile-emma-sheet" : "mobile-field-sheet"}
            role="dialog"
          >
            <header className="mobile-field-sheet-header">
              <div>
                <p className="eyebrow">{activeSheet === "emma" ? "Always available" : "Field app"}</p>
                <h2>{activeSheet === "emma" ? "Ask EMMA" : activeSheet === "actions" ? "What do you need to do?" : "Choose your workspace"}</h2>
              </div>
              <button ref={closeButtonRef} className="button icon" type="button" aria-label={`Close ${activeSheet === "emma" ? "Ask EMMA" : "sheet"}`} onClick={closeSheet}>
                <X aria-hidden="true" />
              </button>
            </header>

            {activeSheet === "actions" ? (
              <div className="mobile-quick-action-list">
                {canManageEvents ? (
                  <button
                    type="button"
                    onClick={() => {
                      closeSheet();
                      onCreateEvent();
                    }}
                  >
                    <CalendarPlus aria-hidden="true" />
                    <span><strong>Create event</strong><small>Open the Master Event Card</small></span>
                  </button>
                ) : null}
                {availableHrefs.has("/tasks") ? <QuickActionLink href="/tasks" icon={ListChecks} title="Review tasks" detail="Update ownership, status, and due dates" /> : null}
                {availableHrefs.has("/communications") ? <QuickActionLink href="/communications" icon={MessageSquareText} title="Review communications" detail="Open draft previews; nothing sends automatically" /> : null}
                {availableHrefs.has("/people") ? <QuickActionLink href="/people" icon={Users} title="Open attendance and people" detail="Continue in the Volunteer Hub" /> : null}
                {availableHrefs.has("/student") ? <QuickActionLink href="/student" icon={GraduationCap} title="Open Student Portal" detail="Journey, Bible, and formation tools" /> : null}
                <button type="button" onClick={() => setActiveSheet("emma")}>
                  <Bot aria-hidden="true" />
                  <span><strong>Ask EMMA</strong><small>Get a page-aware summary or recommendation</small></span>
                </button>
              </div>
            ) : null}

            {activeSheet === "more" ? (
              <div className="mobile-more-content">
                {!isStudentShell ? (
                  <div className="mobile-portal-grid" aria-label="Portals">
                    {portalSections.filter((section) => section.id !== "platform" && section.href).map((section) => {
                      const Icon = sectionIcons[section.id];
                      const active = sectionIsActive(pathname, section);
                      return (
                        <Link className={active ? "mobile-portal-card active" : "mobile-portal-card"} href={section.href ?? "/dashboard"} key={section.id}>
                          <Icon aria-hidden="true" />
                          <span><strong>{section.label}</strong><small>{active ? "Current portal" : "Open portal"}</small></span>
                        </Link>
                      );
                    })}
                  </div>
                ) : null}

                {contextualLinks.length ? (
                  <nav className="mobile-context-links" aria-label={`${activePortal?.label ?? "Current"} tools`}>
                    <p className="eyebrow">{activePortal?.label ?? "Current"} tools</p>
                    {contextualLinks.map((link) => <SheetLink key={link.href} link={link} />)}
                  </nav>
                ) : null}

                {platformLinks.length ? (
                  <nav className="mobile-context-links" aria-label="Platform tools">
                    <p className="eyebrow">Platform tools</p>
                    {platformLinks.map((link) => <SheetLink key={link.href} link={link} />)}
                  </nav>
                ) : null}

                <a className="mobile-sheet-logout" href="/api/auth/logout">
                  <LogOut aria-hidden="true" />
                  Log out
                </a>
              </div>
            ) : null}

            {activeSheet === "emma" ? (
              <div className="mobile-emma-sheet-body">
                <MinistryEmmaPanel defaultExpanded page={emmaPageForPath(pathname)} />
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function QuickActionLink({ href, icon: Icon, title, detail }: { href: string; icon: LucideIcon; title: string; detail: string }) {
  return (
    <Link href={href}>
      <Icon aria-hidden="true" />
      <span><strong>{title}</strong><small>{detail}</small></span>
    </Link>
  );
}

function SheetLink({ link }: { link: AppNavLink }) {
  const Icon = destinationIcons[link.href] ?? LayoutDashboard;
  return (
    <Link href={link.href}>
      <Icon aria-hidden="true" />
      <span>{link.label}</span>
    </Link>
  );
}

function mobileLinkIsActive(pathname: string, href: string, isStudentShell: boolean) {
  if (isStudentShell) return pathname === href || (href !== "/student" && pathname.startsWith(`${href}/`));
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/ministry") {
    return ["/ministry", "/events", "/worship", "/tasks", "/communications", "/budget"].some((route) => pathname === route || pathname.startsWith(`${route}/`));
  }
  if (href === "/people") return pathname === "/people" || pathname.startsWith("/people/") || pathname.startsWith("/directors/volunteers");
  return pathname === href || pathname.startsWith(`${href}/`);
}

function sectionIsActive(pathname: string, section: MobilePortalSection) {
  if (section.id === "volunteer") return pathname.startsWith("/people") || pathname.startsWith("/directors/volunteers");
  if (section.id === "director") return (pathname.startsWith("/directors") && !pathname.startsWith("/directors/volunteers")) || pathname.startsWith("/leader-prep") || pathname.startsWith("/discipleship");
  return section.links.some((link) => pathname === link.href || pathname.startsWith(`${link.href}/`));
}

function emmaPageForPath(pathname: string): MinistryEmmaPage {
  if (pathname.startsWith("/events")) return "events";
  if (pathname.startsWith("/tasks")) return "tasks";
  if (pathname.startsWith("/communications")) return "communications";
  if (pathname.startsWith("/people")) return "people";
  if (pathname.startsWith("/budget")) return "budget";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/worship")) return "worship";
  return "dashboard";
}
