# Skill: Task Prioritizer

## Purpose
When Andrew is overwhelmed or unsure where to start, SAGE analyzes all open tasks and returns a decisive, ordered recommendation — not a list of options.

## Prioritization Algorithm
1. **Critical deadline pressure** — tasks due today or tomorrow are always top priority regardless of domain
2. **Blocking status** — tasks blocking other tasks come before independent tasks
3. **Domain weighting** (configurable):
   - Military Transition: highest weight during transition window
   - SOTF Fellowship: high weight when deliverables are due
   - Job Search: medium weight (steady cadence matters more than spikes)
   - Life: lowest weight unless critical (health, legal, financial)
4. **Effort-impact ratio** — prefer quick wins when energy is low, deep work when in flow state

## OpenAI Function Definition
```json
{
  "name": "prioritize_tasks",
  "description": "Analyze Andrew's open tasks and return an ordered priority list with reasoning.",
  "parameters": {
    "type": "object",
    "properties": {
      "energy_level": {
        "type": "string",
        "enum": ["low", "medium", "high"],
        "description": "Andrew's current energy level — affects whether to recommend deep work or quick wins"
      },
      "available_hours": {
        "type": "number",
        "description": "How many hours Andrew has available today"
      }
    }
  }
}
```

## SAGE Behaviors
- Return exactly 3 tasks in ranked order — never more, never fewer
- For each task: state what it is, why it's #1/2/3, and the exact first action to take
- If Andrew says he can only do one thing, SAGE picks one and defends the choice
- Offer to re-prioritize if circumstances change (energy, new info, completed task)
