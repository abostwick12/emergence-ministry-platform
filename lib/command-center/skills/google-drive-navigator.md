# Skill: Google Drive Navigator

## Purpose
Search for and surface documents from Andrew's Google Drive during conversations.

## OpenAI Function Definitions
```json
[
  {
    "name": "search_drive",
    "description": "Search Google Drive for files relevant to Andrew's request.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": { "type": "string", "description": "Search terms (file name, content, or type)" },
        "file_type": { "type": "string", "description": "Optional: 'doc', 'sheet', 'pdf', 'presentation'", "enum": ["doc", "sheet", "pdf", "presentation", "folder"] }
      },
      "required": ["query"]
    }
  },
  {
    "name": "get_file_summary",
    "description": "Get the metadata and first-page content of a Drive file.",
    "parameters": {
      "type": "object",
      "properties": {
        "file_id": { "type": "string" }
      },
      "required": ["file_id"]
    }
  }
]
```

## Implementation
- Requires Google OAuth (same session as Gmail + Calendar)
- Scope: `drive.readonly`
- Phase 1: Scaffold only
- Phase 2: Real Drive API search
- Route: /api/command-center/integrations/google/drive

## SAGE Behaviors
- When discussing a topic, proactively search for related documents
- Surface recent documents Andrew hasn't opened in a while that may be relevant
- For EMERGE ministry work, help locate event files, budgets, and communications
- For job search, help locate resume versions and cover letter drafts
