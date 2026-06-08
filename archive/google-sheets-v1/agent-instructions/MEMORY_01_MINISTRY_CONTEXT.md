# MEMORY 01 — EMERGE Ministry Context

## Purpose
This memory file gives Codex and future development agents the ministry context behind the EMERGEnce Ministry Platform. It explains who the system serves, the real-world environment it must fit, and the operational problems it is meant to reduce.

## Ministry Identity
EMERGE is the youth ministry of Community Life Church in Gulf Breeze / Navarre, Florida. It serves middle school and high school students through Sunday programming, midweek gatherings, seasonal events, trips, camps, worship, student leadership, volunteer teams, and parent communication.

The ministry is in a rebuilding and scaling season. The platform is not a convenience tool. It is intended to become the operational backbone that helps a small staff plan clearly, communicate consistently, track responsibilities, reduce forgotten tasks, and create accountability without adding unnecessary complexity.

## Primary Users
The primary daily user is Jaci, the ministry coordinator / assistant youth director. She is organized, motivated, and ministry-minded, but the platform must not require her to think like a developer. Every workflow should be simple, visual, and obvious.

Andrew is the project manager and technical maintainer. He will handle code changes, system expansion, and development decisions. The platform should give him enough structure to patch, test, and expand without needing to rebuild from scratch.

The director may need visibility into what is on track, what is stuck, what needs a decision, and where workload is landing. Volunteers and student leaders may be included later, but permissions are intentionally open during the trial and will be tightened after the workflow is proven.

## Ministry Team Reality
The ministry is led by a small team with volunteers. The system must assume real ministry messiness:

- Events are sometimes added late.
- Details are sometimes incomplete at creation.
- Dates, times, and locations may change.
- Parent communication must be clear and trustworthy.
- Leader communication must be warm, direct, and easy to act on.
- Files get scattered unless the platform gives them a home.
- Volunteers and staff can forget tasks when the system does not surface them.
- The primary user should not need to manually maintain duplicate records.

## Ministry Communication Culture
EMERGE communication is warm, relational, friendly, and ministry-centered. It should sound like real leaders communicating with parents, students, and volunteers, not generic church software.

Communication should be:

- Warm and clear
- Actionable
- Youth-ministry appropriate
- Emoji-free in the platform interface
- Not corporate
- Not forced teen slang
- Honest when information is missing
- Careful with sensitive information

When generating communication, the platform should consult the uploaded voice/context documents for email, GroupMe, blast text, and leader communication. Jaci's voice is especially important for Camp Oakwood and parent/leader communication.

## Ministry Guardrails
The system must never invent ministry details. It must not fabricate dates, times, locations, costs, attendance numbers, Planning Center links, leader names, Scripture quotes, policies, or student information.

If something is missing, EMMA should say so, leave a placeholder, or ask the user.

Use placeholders such as:

```text
[NEEDS CONFIRMATION: return time]
[NEEDS CONFIRMATION: cost]
[NEEDS CONFIRMATION: registration deadline]
```

The system must not store or casually summarize student-specific medical, counseling, behavior, mental health, family, or pastoral-care information in version 1.

Medical release and prescription addendum documents may be linked as required files, but individual student medical details should not be summarized in briefs, messages, or tables.

## Ministry Success Definition
The platform is not considered launched until:

1. A real event has been planned end-to-end inside the platform.
2. A real student/attendance workflow has been tested through Planning Center Check-Ins sync or the Student List structure.
3. Jaci has operated it for one full week without needing developer help for normal use.

The first pilot event is:

```text
Camp Oakwood 2026
June 29–July 3
Primary Owner: Jaci
Backup Owner: none
```

Camp Oakwood is the pilot because it tests event planning, documents, parent communication, leader communication, registration tracking, transportation, forms, medical release handling, packing list, budget, and task tracking.

## Key Ministry Documents Already Present
The build context includes uploaded ministry files such as:

- GroupMe Context
- Blast Text Context
- EMERGE Emails
- Jaci Bostwick Emails
- Camp Oakwood Packing List
- Camp Covenant 2026
- Summer Camp Medical Release / Prescription Addendum
- Existing EMERGEnce platform context documents

These files should be used for voice, patterns, and real ministry details when appropriate, but EMMA must still avoid inventing missing facts.
