# Skill: Networking Activator

## Purpose
Turn Andrew's existing network into active job search leverage through consistent, low-friction outreach.

## Activation Strategy
- **Warm network first** — people who already know and respect Andrew (military peers, ministry colleagues, SOTF cohort)
- **Connector identification** — people who know the decision-makers at target companies
- **Content → conversation** — post content on LinkedIn to create natural reasons to reconnect
- **Weekly cadence** — 2 outreach messages per week, 1 follow-up, 1 thank-you

## Contact Categories
1. Peer champions — military/ministry peers at or above Andrew's level in civilian roles
2. Connectors — 2nd-degree connections at target companies
3. Recruiters — active military/veteran recruiters on LinkedIn
4. SOTF cohort — fellowship peers as mutual accountability and referral network
5. Decision-makers — VPs, EDs, COOs at target organizations

## OpenAI Function Definition
```json
{
  "name": "generate_outreach_plan",
  "description": "Generate this week's networking outreach plan with specific names, message types, and draft messages.",
  "parameters": {
    "type": "object",
    "properties": {
      "target_count": {
        "type": "integer",
        "default": 3,
        "description": "How many people to reach out to this week"
      },
      "focus": {
        "type": "string",
        "enum": ["warm_reconnect", "target_company", "recruiter", "sotf_cohort", "mixed"],
        "default": "mixed"
      }
    }
  }
}
```

## SAGE Behaviors
- Generate draft messages — never just say "you should reach out to someone"
- Track who has been contacted and surface follow-up timing (7-day default)
- Help Andrew respond to LinkedIn messages quickly — draft replies for his review
- Remind Andrew that networking is a long game — celebrate consistency over outcomes
- Integrate with the Job Application Tracker (job_applications table) to track pipeline (researching → applied → phone screen → interview → offer)
