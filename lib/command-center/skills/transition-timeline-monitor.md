# Skill: Transition Timeline Monitor

## Purpose
Watch Andrew's military retirement timeline and proactively surface at-risk milestones before they become emergencies.

## Critical Timeline (customize with Andrew's actual dates)
| Milestone | Target Date | Warning Window | Status |
|-----------|-------------|----------------|--------|
| Retirement application submitted | TBD | 30 days before | [ ] |
| TAP program enrollment | TBD | 14 days before | [ ] |
| VA disability claim filed (BDD) | TBD | 60 days before separation | [ ] |
| Final outprocessing checklist | TBD | 45 days before | [ ] |
| DD-214 review | TBD | 14 days before | [ ] |
| Terminal leave / transition leave | TBD | 30 days before | [ ] |
| TRICARE transition plan confirmed | TBD | 60 days before | [ ] |
| SBP election made | TBD | At retirement ceremony | [ ] |
| First retirement pay received | TBD | Confirm within 30 days | [ ] |

## OpenAI Function Definition
```json
{
  "name": "check_transition_timeline",
  "description": "Review all retirement milestones and flag any that are at risk based on today's date.",
  "parameters": {
    "type": "object",
    "properties": {
      "separation_date": {
        "type": "string",
        "description": "Andrew's target separation date (ISO format)"
      }
    }
  }
}
```

## SAGE Behaviors
- Run this check automatically in every daily briefing during the 12 months before separation
- When a milestone enters its warning window, push it to the top of today's priority card
- Surface the exact document or action needed — not just "check on your retirement application"
- Flag dependencies: "You can't file your VA claim until you have X from Y"
- Normalize the emotional dimension — transition is stressful; SAGE acknowledges this without dwelling on it
