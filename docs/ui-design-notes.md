# UI Design Notes

## Desired Feel

The interface should feel like a polished product similar to Monday.com: bright, organized, fast to scan, and clearly interactive.

## Visual Direction

- Emerge brand presence should be clear in the first view.
- Use a fixed left sidebar for core navigation.
- Use top module tabs for fast switching.
- Use clean KPI cards for summaries.
- Use tables only when tables are the right interaction.
- Use Kanban cards for task movement and near-term planning.
- Avoid cluttered spreadsheet-cell dashboards.

## Interaction Rules

- Left navigation must switch views.
- Top tabs must switch views.
- Add Event must open a form.
- Kanban task controls must update task status.
- Communication actions must create drafts, not send messages.
- EMMA should open an assistant panel or modal.

## Current Architecture Direction

Use Apps Script HTML/CSS/JS as the primary UI and hidden Google Sheets tabs as the database.
