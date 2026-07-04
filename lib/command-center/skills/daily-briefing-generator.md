# Skill: Daily Briefing Generator

## Purpose
Generate Andrew's morning context in under 90 seconds — what matters today, what changed overnight, and what to focus on first.

## Briefing Structure
1. **Today's Priority** — single most critical task (AI-selected from open tasks by priority + due date)
2. **Deadlines This Week** — tasks due in next 7 days, sorted by domain
3. **Fresh Intelligence** — 3 curated items from the daily resource feed (job market, military transition, SOTF, leadership)
4. **Calendar Preview** — today's events and tomorrow's prep
5. **SAGE's Take** — 2-3 sentence synthesis: "Here's how I'd approach today if I were you"

## Resource Feed Sources (Phase 2 with Firecrawl)
- Military transition: militarytimes.com, va.gov/news, HireOurHeroes.org
- Job market (last 30 days): LinkedIn Talent Insights, Indeed Hiring Lab
- Leadership & exec: Harvard Business Review, First Round Capital blog
- SOTF / faith leadership: relevant fellowship resource feeds

## Phase 1 Implementation
- Returns 3 hardcoded BriefingItems as seed content
- "Today's Priority" computed from task data (already live in overview API)
- Calendar preview: shows Google Calendar events if connected, placeholder if not

## SAGE Behaviors
- Deliver briefing in bullet format — never paragraphs for the morning brief
- Lead with action ("Your most important task today is X because Y")
- Keep total reading time under 90 seconds
- Do not include tasks that are already done or blocked without a clear unblock path
