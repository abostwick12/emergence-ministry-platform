# EMERGEnce Ministry Platform — Agent Instructions

This repository is the **Next.js web-app version** of the EMERGEnce Ministry Platform.

Do not follow any previous Google Sheets, Apps Script, clasp, or spreadsheet-specific instructions unless they are located inside `/archive/google-sheets-v1/` and are explicitly referenced for historical context.

## Active Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Supabase-ready data model
- Stubbed integrations for MVP 1

## Active Source Folders

The active application source should live in:

- `app/`
- `components/`
- `lib/`
- `supabase/`

Do not treat `/archive/google-sheets-v1/` as active application code.

## MVP 1 Scope

Build only the Admin/Leader event automation vertical slice:

Create event → generate baseline tasks → assign/update tasks → view event workspace → preview communications → view budget shell → view integration activity → record activity log.

## Do Not Build in MVP 1

- live Planning Center OAuth
- live Google Calendar sync
- live Google Drive folder creation
- live ProPresenter playlist creation
- live AI/OpenAI/Gemini calls
- real email/text/GroupMe sending
- parent portal
- student portal
- QR check-in
- attendance system
- advanced analytics

## Integration Rule

All integrations must use Stub Mode adapters in MVP 1.

Do not call external APIs or require live credentials.

## Verification Rule

Before marking work complete, run:

```bash
npm install
npm run typecheck
npm run lint
npm run build
```
