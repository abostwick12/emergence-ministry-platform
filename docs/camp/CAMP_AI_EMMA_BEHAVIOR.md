# Camp EMMA Behavior

Verified from codebase inspection on 2026-06-23.

**Source files inspected:**
- `components/camp/camp-emma-sheet.tsx` — frontend sheet component
- `components/camp/camp-nav.tsx` — EMMA trigger in nav
- `app/api/camp/emma/route.ts` — server-side route
- `lib/camp/emma.ts` — answer-building logic

---

## 1. Where EMMA Appears

**Status: Live** (not a placeholder or stub as of 2026-06-23).

EMMA appears as a bottom-sheet modal (`CampEmmaSheet`) triggered from the `CampNav` navigation bar. The EMMA icon (`EmmaWaveOrb`) is visible in the nav for all Camp roles.

When the user taps the EMMA icon, `CampEmmaSheet` opens with a search input and example queries.

---

## 2. Entry Point and Component Structure

| Item | Detail |
|---|---|
| Trigger | `EmmaWaveOrb` icon in `CampNav` |
| Component | `CampEmmaSheet` (`components/camp/camp-emma-sheet.tsx`) |
| Type | Bottom-sheet modal (full-screen overlay on mobile) |
| Close behavior | Tap outside sheet, or press close button |
| Rendered for | All Camp roles (EMMA icon always visible in nav) |

The sheet shows a search input, role-appropriate example queries, and the answer from the last successful search.

---

## 3. Request Payload

The frontend sends a `POST` to `/api/camp/emma` with:

```json
{
  "query": "<user's search string>",
  "mode": "finder" | "smart_search" | "ask_emma",
  "selectedDay": "<ISO date string or undefined>",
  "medicalCommandActive": true | false
}
```

`mode` is determined client-side based on the user's capabilities:
- General leaders / drivers → `finder`
- Andrew / Jaci → `smart_search`

`medicalCommandActive` is true when the home screen is in Medical Command mode. Used to trigger `andrew_medical` access tier on the server.

URL query params: `?role=<current role>&vehicleId=<id if driver>`

---

## 4. Server Route (`POST /api/camp/emma`)

File: `app/api/camp/emma/route.ts`

**Authorization flow:**
1. Authenticate session (`getServerSession()`)
2. Resolve Camp access context (`resolveCampAccessForRequest()`) — trusts durable table; ignores client role param in production
3. Validate mode: non-`finder` modes require `canAccessRestricted === true` AND `restrictedActor ∈ {Andrew, Jaci}` — Joel is explicitly excluded
4. Build EMMA access tier (`resolveEmmaAccess()`)
5. Fetch overview data (`getCampOverview()`)
6. If `medicalCommandActive` AND `canAccessCampMedicalCommand()`: fetch restricted medication payload (`getRestrictedCampMedicationPayload()`) and build medical blocks
7. Build and return answer (`buildCampEmmaAnswer()`)

**No live AI provider is called.** `buildCampEmmaAnswer()` is deterministic pattern matching in `lib/camp/emma.ts` — not a language model call.

---

## 5. Role-Based Access Modes

| EMMA Access Tier | Resolved When | What EMMA Returns |
|---|---|---|
| `leader` | Anyone who is not Andrew or Jaci | Safe operational data only: roster, teams, rooms, vehicles, schedule, form status |
| `jaci` | Jaci (medical_coordinator) | Same as leader (safe operational data from overview), but with smart_search scope |
| `andrew_operations` | Andrew, medicalCommandActive = false | Same scope as Jaci; safe operational + restricted-safe flags |
| `andrew_medical` | Andrew, medicalCommandActive = true | Medication time block summary (count of Due/Completed/Needs Attention/Missing); no dosage, no signatures, no insurance |

Access tier mapping from `app/api/camp/emma/route.ts → resolveEmmaAccess()`:
```typescript
if (actor === "Andrew") return medicalCommandActive ? "andrew_medical" : "andrew_operations";
if (actor === "Jaci") return "jaci";
return "leader";
```

---

## 6. Finder (Safe) Mode Behavior

Available to all roles. Answers queries about:
- Which camper is on which team
- Who is in a specific vehicle
- What time is a schedule item
- Who is a team leader
- What cabin/room a camper is in
- Shirt size counts
- Transportation assignments
- Leader briefing (teams with missing leaders, upcoming schedule)

Does NOT return:
- Medication names or dosages
- Medical notes free text
- Insurance information
- Guardian/parent phone numbers
- Dietary requirement details

---

## 7. Smart Search / Ask EMMA Mode Behavior

Available to Andrew and Jaci only. Adds access to:
- Safe indicator flags (hasMedicalAlert, hasDietaryAlert) — as booleans, not free text
- Medical alert counts
- Dietary alert counts
- Leader briefing including safe flag summaries

Still does NOT return:
- Free-text medical notes
- Medication names or dosages
- Insurance data
- Guardian/parent contact details

---

## 8. Andrew Medical Command Mode

Triggered when `medicalCommandActive = true` AND `canAccessCampMedicalCommand()` = true (Andrew only).

Returns:
- Medication time block summary per student per window (Due / Completed / Needs Attention / Intake Missing)
- Whether parent handoff intake is on file
- Count of pending medication tasks

Does NOT return:
- Specific medication names or dosages
- Signature data
- Insurance information
- Raw medical notes

The `andrew_medical` tier is the most permissive EMMA tier, and its data is limited to scheduling state (what needs to happen, not what the medications are).

---

## 9. Restricted Content Guard

In `lib/camp/emma.ts → buildCampEmmaAnswer()`:

```typescript
const restrictedNeedles = [
  "medication", "dose", "allergy details", "insurance",
  "parent phone", "guardian", "physician", "medical notes"
];

if (input.access !== "andrew_medical" && restrictedNeedles.some(needle => normalized.includes(needle))) {
  return {
    answer: "I can help with safe operational Camp information, but restricted medical details are not available in this mode.",
    details: ["Try asking for team, room, transportation, schedule, form, or safe status information."],
    actions: [{ label: "Open Leader Safety", href: "/camp/safety" }]
  };
}
```

Any query containing a restricted needle is intercepted before answer-building unless the user has `andrew_medical` access.

---

## 10. Example Queries by Role

**Leader / Finder examples (shown in UI):**
- "Where is Avery?"
- "Who is on Blue Team?"
- "Who is in Van 2?"
- "What time is dinner?"

**Smart Search examples (Andrew / Jaci, shown in UI):**
- "What room is Avery in?"
- "Which teams are short a leader?"
- "Which students are missing rooms?"
- "Give me a leader briefing for tonight"

---

## 11. Prohibited EMMA Behavior

EMMA must never:
- Return medication names, dosages, or administration instructions to any role
- Return free-text medical notes to any role (including Andrew — time block counts only)
- Return insurance information to any role
- Return guardian/parent phone numbers to any role
- Surface restricted dietary note content to leaders or drivers
- Enumerate the full student roster in response to unknown-camper lookups (returns "not found" instead)
- Call a live AI provider (no external AI provider is wired — all answers are deterministic)

---

## 12. Audit Logging

**The current Camp EMMA route (`/api/camp/emma`) does NOT log to the EMMA audit tables** (`ai_requests`, `ai_runs`, etc. from migration 006). It is a standalone deterministic route that does not use the `lib/emma/repository.ts` lifecycle.

The general EMMA audit infrastructure exists in `lib/emma/` and is used for the main EMMA workflows (event planning, task generation). Camp EMMA is a separate, lighter-weight implementation.

**Known gap**: Camp EMMA search queries are not audited to the `ai_requests` table. If audit logging of Camp searches is desired, this is a future enhancement.

---

## 13. No Live AI Provider in Current Working Tree

As of 2026-06-23, the Camp EMMA route that is currently live (`app/api/camp/emma/route.ts`) does not call any external AI provider. `buildCampEmmaAnswer()` in `lib/camp/emma.ts` is entirely deterministic:
- Keyword/substring matching on the query string
- Pattern checks for query types (briefing, transportation, teams, rooms, schedule)
- Returns structured `CampEmmaAnswer` objects (answer string + details array + actions array)

**However**: The uncommitted `.env.example` changes (pre-existing, not caused by this doc scrub) add `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, `AZURE_OPENAI_DEPLOYMENT`, and `AZURE_OPENAI_API_VERSION` variables for a "Camp-scoped EMMA room-change command slice" and reference `lib/camp/emma-command.ts` and `lib/camp/emma-azure-provider.ts`. These files **do not exist in the current working tree**.

This suggests uncommitted or stashed Camp EMMA Azure provider work. See also memory note: "Camp EMMA uncommitted recovery — Camp mobile+EMMA work NOT committed; recover via `git stash apply stash@{0}` on feat/camp-command-center-mobile-emma."

**Risk**: If `emma-command.ts` and `emma-azure-provider.ts` are recovered and introduced, the EMMA access model documented here must be re-audited to ensure restricted data cannot be sent to the Azure OpenAI provider.

See `docs/camp/CAMP_KNOWN_GAPS.md` Gap 10 for full documentation of this discrepancy.

---

## 14. Regression Risks

1. **Access tier gate removal**: Removing or relaxing the `restrictedActor ∈ {Andrew, Jaci}` check on non-finder modes would expose restricted-flag data to all authenticated users.

2. **Restricted needle bypass**: Removing or narrowing the `restrictedNeedles` list would allow restricted-content queries to reach answer-building logic for leader-tier access.

3. **Medical Command gate bypass**: Allowing `medicalCommandActive = true` to resolve `andrew_medical` access for non-Andrew users would expose medication scheduling data.

4. **Client mode parameter trust**: The mode is sent by the client but is validated server-side. If server validation (`normalizeMode()`) is weakened, clients could request `smart_search` mode and receive restricted-flag data without authorization.

5. **Provider call introduction**: If a live AI provider (Gemini, Claude, etc.) is added to the Camp EMMA route, the restricted content guard must be audited carefully — a language model could surface restricted content from the overview context if the context is not sanitized before sending to the model.
