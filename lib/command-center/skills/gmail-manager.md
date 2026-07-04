# Skill: Gmail Manager

## Purpose
Read, triage, and draft emails from Andrew's Gmail account.

## OpenAI Function Definitions
```json
[
  {
    "name": "list_recent_emails",
    "description": "Retrieve the most recent emails from Andrew's inbox. Use to triage or summarize what needs attention.",
    "parameters": {
      "type": "object",
      "properties": {
        "max_results": { "type": "integer", "default": 10 },
        "label": { "type": "string", "description": "Optional Gmail label filter (e.g. INBOX, UNREAD)" },
        "query": { "type": "string", "description": "Gmail search query (e.g. 'from:recruiter is:unread')" }
      }
    }
  },
  {
    "name": "draft_email",
    "description": "Create a draft email in Andrew's Gmail. Does NOT send — Andrew reviews first.",
    "parameters": {
      "type": "object",
      "properties": {
        "to": { "type": "string" },
        "subject": { "type": "string" },
        "body": { "type": "string" },
        "context": { "type": "string", "description": "Why this email is being drafted" }
      },
      "required": ["to", "subject", "body"]
    }
  }
]
```

## Implementation
- Requires Google OAuth (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET)
- Scope: `gmail.readonly` for reading, `gmail.compose` for drafting
- OAuth flow: Phase 2 — Phase 1 shows connected/disconnected status only
- Route: /api/command-center/integrations/google/gmail

## SAGE Behaviors
- Never send email without explicit confirmation — always create drafts first
- Prioritize: flag emails about job applications, military transition, and SOTF as high priority
- Help Andrew write emails he's been avoiding — "avoidance drafting" is a key skill
- Summarize long email threads to reduce reading overhead
