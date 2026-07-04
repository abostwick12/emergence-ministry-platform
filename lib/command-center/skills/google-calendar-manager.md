# Skill: Google Calendar Manager

## Purpose
Read Andrew's calendar to give SAGE time context, and create events from tasks and commitments.

## OpenAI Function Definitions
```json
[
  {
    "name": "get_upcoming_events",
    "description": "Retrieve Andrew's upcoming calendar events to understand his schedule.",
    "parameters": {
      "type": "object",
      "properties": {
        "days_ahead": { "type": "integer", "default": 7, "description": "Number of days to look ahead" },
        "calendar_id": { "type": "string", "default": "primary" }
      }
    }
  },
  {
    "name": "create_calendar_event",
    "description": "Add an event to Andrew's Google Calendar. Use for scheduling tasks, deadlines, and appointments.",
    "parameters": {
      "type": "object",
      "properties": {
        "title": { "type": "string" },
        "start_datetime": { "type": "string", "description": "ISO 8601 format" },
        "end_datetime": { "type": "string", "description": "ISO 8601 format" },
        "description": { "type": "string" },
        "location": { "type": "string" },
        "reminder_minutes": { "type": "integer", "default": 30 }
      },
      "required": ["title", "start_datetime", "end_datetime"]
    }
  }
]
```

## Implementation
- Requires Google OAuth (same token as Gmail — shared Google session)
- Scope: `calendar.readonly` + `calendar.events`
- Phase 1: UI shows connect button, returns stub data
- Phase 2: Real Google Calendar API reads/writes
- Route: /api/command-center/integrations/google/calendar

## SAGE Behaviors
- When Andrew mentions a deadline, offer to add it to his calendar
- Surface schedule conflicts before suggesting a task for a specific day
- Protect deep work blocks — flag if calendar is becoming too fragmented
- For retirement milestones, create recurring reminder events ahead of each deadline
