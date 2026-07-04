# Skill: LinkedIn Networker

## Purpose
Support Andrew's LinkedIn strategy for military transition and job search.

## Strategy Context
Andrew's LinkedIn is both a job search tool and a thought leadership platform. His network spans military peers, ministry leaders, and emerging tech connections.

## Key Activities
1. **Profile optimization** — headline, About section, featured posts, recommendations
2. **Connection activation** — identify warm contacts at target companies
3. **Content strategy** — weekly thought leadership post to stay visible to recruiters
4. **Outreach messaging** — warm introduction requests, recruiter responses, follow-ups
5. **Job alerts** — daily check of LinkedIn Jobs for target role matches

## OpenAI Function Definition (Phase 2)
```json
{
  "name": "draft_linkedin_message",
  "description": "Draft a LinkedIn connection request or direct message for Andrew to review and send manually.",
  "parameters": {
    "type": "object",
    "properties": {
      "recipient_name": { "type": "string" },
      "recipient_context": { "type": "string", "description": "Who this person is and why Andrew wants to connect" },
      "message_type": { "type": "string", "enum": ["connection_request", "follow_up", "job_inquiry", "thank_you"] },
      "purpose": { "type": "string" }
    },
    "required": ["recipient_name", "message_type", "purpose"]
  }
}
```

## Implementation
- Phase 1: SAGE drafts messages for Andrew to copy/paste manually (no LinkedIn API)
- Phase 2: LinkedIn OAuth for profile reading and message drafting via API
- Note: LinkedIn API is restrictive — most value comes from SAGE drafting content Andrew sends himself

## SAGE Behaviors
- Draft LinkedIn posts Andrew can publish with one click
- Suggest specific people to reach out to each week from Andrew's existing connections
- Help Andrew respond to recruiter messages professionally and efficiently
- Track outreach: who was messaged, when, and what follow-up is needed
- Remind Andrew that consistency beats volume on LinkedIn
