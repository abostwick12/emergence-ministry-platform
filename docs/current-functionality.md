# Current Web App Functionality

Current as of June 23, 2026. (Originally drafted June 11, 2026; date corrected during 2026-06-23 doc scrub.)

> **Camp module**: For Camp-specific feature inventory, access model, import field map, and regression checklist, see [`docs/camp/CAMP_BLUEPRINT.md`](camp/CAMP_BLUEPRINT.md).

This diagram reflects the active Next.js web app only. The archived Google Sheets and Apps Script build under `archive/google-sheets-v1/` is historical context and is not active application code.

```mermaid
flowchart TD
  Visitor["Visitor"] --> Middleware["Auth middleware"]
  Middleware -->|No valid session| Login["Login page"]
  Login -->|Supabase Auth or local mock auth| AppShell["Protected app shell"]
  Middleware -->|Valid session| AppShell

  AppShell --> RoleShell["Role-aware shell"]
  RoleShell --> AdminLeader["Admin and Leader active views"]
  RoleShell --> StudentParent["Student and Parent inactive placeholders"]

  AdminLeader --> Dashboard["Dashboard ministry snapshot"]
  AdminLeader --> Events["Events Workspace board"]
  AdminLeader --> Tasks["Tasks Workspace"]
  AdminLeader --> PlaceholderPages["Communications, People, Files, Budget, Settings placeholders"]

  Dashboard --> TodayWeek["Today / This Week orientation"]
  Dashboard --> Upcoming["Upcoming events"]
  Dashboard --> Attention["Tasks needing attention: overdue, due this week, stuck"]
  Dashboard --> PendingComms["Communication previews pending review"]
  Dashboard --> RecentActivity["Recent activity"]
  Dashboard --> QuickLinks["Links to Events, Tasks, Communications"]

  Events --> CreateEvent["Admin create event form"]
  CreateEvent --> DateUx["Start date auto-fills end date until end is manually changed"]
  CreateEvent --> ApiEvents["POST /api/events"]
  ApiEvents --> TemplateTasks["Default event template generates baseline tasks"]
  TemplateTasks --> ActivityCreated["Activity log: event created and tasks generated"]

  Events --> GroupedBoard["Grouped board rows: This Week, This Month, Long Range Planning, Past Events"]
  GroupedBoard --> FixedIdentity["Fixed event identity column"]
  GroupedBoard --> FixedDate["Fixed date/time column"]
  GroupedBoard --> ScrollSummary["Horizontally scrollable summary fields"]
  ScrollSummary --> SummaryFields["Owner, location, budget, volunteers, completion, missing info, status, communication readiness, Drive status"]
  ScrollSummary --> EventNotes["Internal event notes"]
  ScrollSummary --> OpenCommand["Open Command Center"]

  GroupedBoard --> ExpandTasks["Expand compact task tree"]
  ExpandTasks --> TaskRows["Task rows: title, due date, owner, status, quick status, file placeholder, notes"]
  TaskRows --> AutoDue["Due date autosaves on selection"]
  TaskRows --> TaskPatch["PATCH /api/tasks/[id]"]
  TaskPatch --> TaskActivity["Activity log: status, owner, due date, title, notes changes"]

  OpenCommand --> CommandCenter["Command Center: selected event"]
  CommandCenter --> EventInfo["Event Information and internal notes"]
  CommandCenter --> MissingInfo["Missing Information panel"]
  CommandCenter --> TimelineTasks["Timeline Tasks"]
  CommandCenter --> CommPreviews["Communication Previews"]
  CommandCenter --> BudgetShell["Budget Shell"]
  CommandCenter --> IntegrationActivity["Integration Activity"]
  CommandCenter --> ActivityLog["Activity Log"]

  CommPreviews --> GeneratePreview["Generate preview"]
  GeneratePreview --> PreviewApi["POST /api/events/[id]/generate-communications"]
  PreviewApi --> PreviewOnly["Parent Email, Leader Announcement, Blast Text Summary"]
  PreviewOnly --> NoSend["Preview only - no external communication is sent"]

  IntegrationActivity --> StubAdapters["Stub Mode adapters"]
  StubAdapters --> DriveStub["Google Drive folder stub"]
  StubAdapters --> CalendarStub["Google Calendar sync stub"]
  StubAdapters --> ProStub["ProPresenter stub"]
  StubAdapters --> StubLogs["Integration and activity records only"]

  Tasks --> Kanban["Compact Kanban"]
  Kanban --> StatusLanes["To do, In progress, Stuck, Done"]
  StatusLanes --> CollapsedCards["Collapsed task cards with edit on demand"]
  Tasks --> TaskList["Grouped task list by event"]
  TaskList --> TaskEdits["Status, due date, and notes updates"]

  PlaceholderPages --> DisabledFuture["Disabled Coming Soon controls"]
  StudentParent --> InactiveGuard["Inactive route placeholders only"]

  DataLayer["Data layer"] --> SupabaseReady["Supabase-ready repository and schema"]
  DataLayer --> MockSeed["Local seeded mock data fallback"]
  ApiEvents --> DataLayer
  TaskPatch --> DataLayer
  PreviewApi --> DataLayer
  StubAdapters --> DataLayer
```

## Active Boundaries

- Active source folders: `app/`, `components/`, `lib/`, `supabase/`, `tests/`, `scripts/`, and `docs/`.
- Integrations remain Stub Mode only.
- Communications are previews only and are not sent.
- Student and Parent routes remain inactive placeholders.
- Notes are internal staff notes stored on events and tasks.
- Core records (profiles, events, tasks, activity logs) are scoped to a ministry via `ministry_id`. The app runs as a single default **Emerge** ministry today; Row Level Security restricts access to the authenticated user's ministry. See `docs/emma/architecture.md` (Implementation Note: Ministry Scope).
