# UI Design Notes

## Desired Feel

The interface should feel like a polished ministry operations product: bright, organized, fast to scan, and clearly interactive. It should remain understandable to non-technical staff who need to plan events repeatedly without reading a manual.

## Visual Direction

- Lead Emergence brand presence should be clear in the first view.
- Use the approved fixed left sidebar and fixed dashboard header.
- Preserve independently scrollable main content.
- Keep dashboard metrics, Ministry Calendar, Ministry Pulse, and Next on the Calendar easy to scan.
- Use clean KPI cards for summaries.
- Use board rows, task lists, and Kanban views when those are the right interaction.
- Use the Master Event Card for event creation and editing.
- Avoid cluttered spreadsheet-cell dashboards.
- Avoid reintroducing old MVP top boxes, marketing cards, quote/footer content, or retired branding.

## Interaction Rules

- Left navigation must switch views.
- Add Event must open the Master Event Card.
- Event board controls must open or update the intended event/task state.
- Kanban and task-list controls must update task status, due dates, owners, or notes intentionally.
- Communication actions must create previews or drafts, not send messages.
- Stub Mode integration controls must clearly remain previews/activity records until live providers are approved.
- Every visible control must work, open an intentional placeholder, or be clearly disabled and labeled.

## Current Architecture Direction

Build the active web application using Next.js App Router, React, TypeScript, Tailwind CSS/global design tokens, Supabase Auth, Supabase Postgres, Vercel, and Playwright.

Historical Google Sheets, Apps Script HTML/CSS/JS, and clasp materials belong only in clearly labeled archive locations and should not guide current UI implementation.
