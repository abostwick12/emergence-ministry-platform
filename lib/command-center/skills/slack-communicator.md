# Skill: Slack Communicator

## Purpose
Send messages and notifications to Andrew's Slack workspace from SAGE.

## OpenAI Function Definition
```json
{
  "name": "send_slack_message",
  "description": "Send a message to a Slack channel or DM via webhook. Use when Andrew asks you to notify his team, post an update, or send a reminder.",
  "parameters": {
    "type": "object",
    "properties": {
      "channel": {
        "type": "string",
        "description": "Slack channel name (e.g. #general) or user ID for DMs"
      },
      "message": {
        "type": "string",
        "description": "The message text to send. Can include Slack markdown."
      },
      "context": {
        "type": "string",
        "description": "Why this message is being sent — for Andrew's audit trail"
      }
    },
    "required": ["channel", "message"]
  }
}
```

## Implementation
- Uses outbound webhook (SLACK_WEBHOOK_URL env var) — no OAuth needed for Phase 1
- Phase 2: Slack Bot OAuth for reading messages and channel listing
- Route: POST /api/command-center/integrations/slack

## SAGE Behaviors
- Always confirm the message content with Andrew before sending
- Suggest appropriate channels based on context (team update → #general, private check-in → DM)
- Draft the message text; let Andrew edit before sending
