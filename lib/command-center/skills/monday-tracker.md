# Skill: Monday.com Tracker

## Purpose
Read and update Andrew's Monday.com boards to keep his work tracked without manual data entry.

## OpenAI Function Definitions
```json
[
  {
    "name": "list_monday_items",
    "description": "List items from Andrew's Monday.com boards.",
    "parameters": {
      "type": "object",
      "properties": {
        "board_id": { "type": "string", "description": "Monday.com board ID" },
        "status_filter": { "type": "string", "description": "Optional status filter" }
      },
      "required": ["board_id"]
    }
  },
  {
    "name": "update_monday_item",
    "description": "Update the status or details of a Monday.com item.",
    "parameters": {
      "type": "object",
      "properties": {
        "item_id": { "type": "string" },
        "column_id": { "type": "string" },
        "value": { "type": "string" }
      },
      "required": ["item_id", "column_id", "value"]
    }
  },
  {
    "name": "create_monday_item",
    "description": "Create a new item on a Monday.com board.",
    "parameters": {
      "type": "object",
      "properties": {
        "board_id": { "type": "string" },
        "item_name": { "type": "string" },
        "column_values": { "type": "object", "description": "Key-value pairs of column ID to value" }
      },
      "required": ["board_id", "item_name"]
    }
  }
]
```

## Implementation
- Requires MONDAY_API_TOKEN (personal API token, no OAuth needed)
- Phase 1: Status card shows "connect" with API token input
- Phase 2: Real Monday.com GraphQL API integration
- Route: /api/command-center/integrations/monday

## SAGE Behaviors
- Sync personal_tasks from Command Center to Monday.com on request
- When a task is marked done in Monday, suggest updating Command Center
- Help Andrew keep his Monday boards clean — surface stale items
- Use Monday for team-visible tracking; Command Center for personal tracking
