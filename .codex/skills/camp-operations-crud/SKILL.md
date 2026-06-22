---
name: camp-operations-crud
description: Use when building or revising Camp Oakwood operational features so each one becomes a connected create/read/update/delete workflow. Applies to schedule, transportation, teams, roster, documents/forms, Camp Updates, and roster import.
---

# Camp Operations CRUD

## Purpose

Turn the Camp app from a read-only dashboard into connected CRUD operations. Every operational surface should let a leader create, view, edit, and save real data, with changes that flow through to every related view.

## Standard Editor Behavior

Each editable item follows the same lifecycle:

- **Create** — open an empty editor from a clear "Add" affordance.
- **View** — open a detail view that shows the item's current saved state.
- **Edit** — switch the detail into an editable form, pre-filled with current values.
- **Save** — persist the change, then show clear success feedback. On failure, show a clear, specific error and keep the user's input.
- **Cancel** — discard unsaved edits and return to the prior state without side effects.
- **Delete / Archive** — remove or archive with a confirmation step when the action is destructive or affects others. Prefer archive over hard delete where history matters.

Always confirm destructive or far-reaching actions before committing them.

## Responsive Modal / Sheet Pattern

- Desktop: focused modal or popover anchored to the triggering control.
- Mobile: full-screen sheet or bottom sheet.
- Same data, same validation, and same save semantics across both — only the container differs.
- Interaction flow: click/tap → modal or detail sheet → edit → save → clear success/error feedback.
- Keep focus management, dismissal, and keyboard/escape behavior consistent.

## Required Operational Coverage

Each of these must support the full editor lifecycle above:

- **Schedule items** — create, edit, time/order changes, and remove schedule entries.
- **Vehicles and riders** — manage vehicles and assign or remove riders.
- **Teams and leader assignments** — create teams; assign and reassign leaders and members.
- **Camper roster fields** — edit the roster fields a leader is permitted to see and change.
- **Documents / forms** — add, view, replace, and remove documents/forms and track their status.
- **Camp Updates** — create, edit, and remove updates and announcements.
- **Roster import** — show a preview of parsed rows, let the user review and correct, then a confirmed commit that writes the rows.

## Connected-View Rule

A save is not finished until it is reflected everywhere it should appear. After a save, the following must show the new state without a manual workaround:

- Home
- Teams
- Roster
- Transportation
- the related detail view that was edited

If a change to one entity affects another view, that view must update too. For example, assigning a rider updates both Transportation and the camper's detail.

## Validation Rule

- Test actual create → edit → save → read cycles against the running app, not just types or unit logic.
- Confirm the saved value persists and reloads correctly.
- Do not claim a feature works until this cycle has been exercised and observed.

## Communication Honesty

- Never claim a message, email, text, or notification was sent when only a copy-ready draft or an activity-log entry was created.
- Label drafts and previews as drafts or previews, not as delivered communications.
