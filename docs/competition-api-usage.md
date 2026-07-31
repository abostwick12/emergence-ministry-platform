# Competition API Usage

This document is the implementation evidence for the Scripture in New Frontiers submission. It describes what the judge-facing UI calls, which external provider actually runs, what data crosses each boundary, and what Lead Emergence deliberately does not persist or automate.

## Runtime Summary

```text
Judge browser
  -> Lead Emergence server route
     -> server-only credential and guest feature gate
        -> YouVersion Platform API for requested Scripture text
        -> Meridian context and validation
           -> Gloo AI Studio for candidate discussion/reading-plan drafts
  <- provider/model provenance and a leader-review artifact
```

No YouVersion or Gloo credential is sent to the browser. AI routes return drafts only. Communication sends, provider writes, and pastoral decisions are outside these generation calls.

## Server-Only Environment Variables

```dotenv
# YouVersion Platform
YOUVERSION_APP_KEY=
YOUVERSION_API_BASE_URL=https://api.youversion.com

# Gloo AI Studio
GLOO_AI_CLIENT_ID=
GLOO_AI_CLIENT_SECRET=
GLOO_AI_BASE_URL=https://platform.ai.gloo.com/ai/v2
GLOO_AI_MODEL=gloo-openai-gpt-5-nano
GLOO_AI_ESCALATION_MODEL=gloo-openai-gpt-5-mini
GLOO_AI_LONG_CONTEXT_MODEL=gloo-google-gemini-2.5-flash-lite

# Competition guest gates
GUEST_AI_GENERATION_ENABLED=false
GUEST_SANDBOX_WRITES_ENABLED=false
```

All variables above are read on the server. Do not create `NEXT_PUBLIC_` variants.

## YouVersion Platform API

### Purpose in Lead Emergence

YouVersion supplies the requested biblical text and the canonical reader surface. Scripture is not decorative content added after an operational decision; it is the source leaders and students return to before formation material is drafted or approved.

### Visible flow

1. A judge opens `/student/scripture/resources?reference=John%203%3A16`.
2. `components/student/scripture-lookup.tsx` sends the reference to `POST /api/student/scripture/lookup`.
3. The route calls `lookupYouVersionPassage` in `lib/scripture/youversion.ts`.
4. The adapter normalizes `John 3:16` to `JHN.3.16` and requests:

   ```http
   GET https://api.youversion.com/v1/bibles/3034/passages/JHN.3.16?format=text&include_headings=false&include_notes=false
   X-YVP-App-Key: <server-only app key>
   Accept: application/json
   ```

5. The UI displays the returned reference/text for the current request and opens the corresponding Bible.com reader surface.

YouVersion’s official documentation requires `X-YVP-App-Key` for API requests and documents the passage endpoint and BSB Bible ID `3034`: [authentication](https://developers.youversion.com/authentication), [API usage](https://developers.youversion.com/api-usage).

### Lead Emergence endpoint

```http
POST /api/student/scripture/lookup
Content-Type: application/json

{
  "reference": "John 3:16"
}
```

Successful response:

```json
{
  "ok": true,
  "passageId": "JHN.3.16",
  "passage": {
    "id": "JHN.3.16",
    "reference": "John 3:16",
    "content": "<provider response>"
  }
}
```

Expected failures are typed as `invalid_reference`, `not_configured`, `not_found`, or `provider_error`. If the passage API is unavailable, the UI keeps the Bible.com reader handoff available and says that live passage text could not be loaded; it does not fabricate Scripture text.

### Data and licensing boundary

- Lead Emergence stores Scripture references and relationships used by Meridian.
- Passage text returned for lookup is rendered for the request; this route does not add it to Meridian memory or a ministry database.
- The UI identifies YouVersion Platform as the text source and links to the YouVersion reader experience.
- The configured app must have access to the Bible/version it requests and must follow the applicable YouVersion license agreement.

## Gloo AI Studio API

### Purpose in Lead Emergence

Gloo AI Studio provides the primary model access for ministry-specific synthesis. Meridian supplies bounded context and validates the result; Gloo does not receive autonomous access to ministry databases or permission to act on the result.

### Authentication and request path

Lead Emergence uses OAuth 2.0 client credentials:

```http
POST https://platform.ai.gloo.com/oauth2/token
Authorization: Basic base64(<client-id>:<client-secret>)
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&scope=api%2Faccess
```

The short-lived bearer token is cached server-side with an expiry buffer. Draft requests then use Gloo’s OpenAI-compatible chat-completions shape:

```http
POST https://platform.ai.gloo.com/ai/v2/chat/completions
Authorization: Bearer <short-lived token>
Content-Type: application/json
```

This matches Gloo’s official [OAuth client-credentials guidance](https://docs.gloo.com/tutorials/authentication) and [OpenAI-compatible SDK/API guidance](https://docs.gloo.com/api-guides/sdks-and-libraries).

### Reading-plan generation

Judge route: `/student/scripture/plans/new`

Lead Emergence endpoint:

```http
POST /api/student/scripture/reading-plan
Content-Type: application/json

{
  "title": "Welcome in Luke 15",
  "audience": "High school small group",
  "duration": "5 days",
  "primaryScripture": "Luke 15",
  "contextNotes": "Notice the three lost-and-found movements.",
  "observationQuestion": "What changes across the three scenes?",
  "interpretationQuestion": "What does Jesus reveal about God?",
  "applicationQuestion": "How should our group respond?",
  "discussionQuestion": "Where is welcome costly?",
  "prayerPrompt": "Teach us to receive and extend your welcome.",
  "guardrailNotes": "Do not collapse the distinct parables into one generic moral."
}
```

`generateMeridianReadingPlanDraft` calls Gloo first when configured. The response includes the provider, exact model, model reason, Scripture movement, daily rhythm, discussion prompts, guardrail notes, prayer prompt, safety notes, and Meridian provenance. The browser labels the result as a draft and does not save or publish it.

### Student-question discussion generation

Lead Emergence endpoint:

```http
POST /api/student/scripture/discussion
Content-Type: application/json

{
  "question": "What does welcome look like when trust has been broken?",
  "scriptureReference": "Luke 15"
}
```

The Gloo result contains a candidate discussion prompt, safety label, safety notes, topic tags, confidence, model tier, and escalation reason. Meridian validation runs before the result is accepted. A low-confidence or safety-sensitive first pass can select the configured escalation model. Leaders still decide whether and how the material should be used.

### Diagnostics

`POST /api/student/scripture/gloo-diagnostics` exchanges credentials and requests a safe test draft. It reports configuration and attempt metadata without returning credentials. When guest AI is disabled, the route returns a labeled stock diagnostic. When enabled, it runs the real provider diagnostic.

`POST /api/student/scripture/knowledge-test` exercises the same draft boundary with Meridian’s approved context-matching surface. It is a preview and does not save or publish a student artifact.

## Guest Flag Behavior

| AI flag | Sandbox-write flag | Judge behavior |
| --- | --- | --- |
| Off | Off | Seeded data is read-only; generation routes return labeled stock previews. |
| On | Off | Judges can call configured AI providers; generated artifacts remain unsaved previews. |
| Off | On | Judges can edit isolated demo state; AI remains stock/deterministic. |
| On | On | Judges can generate live drafts and keep selected edits in their isolated guest session. |

`GUEST_SANDBOX_WRITES_ENABLED` permits only an allowlist of demo routes: event and task records, preview-only event generators, budget expenses, Volunteer Hub actions, discussion review, Journey Journal entries, reflections, and reading-progress state. Live integration prefixes, Google Drive refresh, and event-admin AI remain blocked in middleware.

Guest persistence is deliberately not canonical persistence. Each guest session receives a separate synthetic sandbox. The state can reset on cookie/runtime/deployment reset and must never be described as a production database write.

## Provider Selection and Failure Behavior

- Gloo is attempted first when its client credentials, base URL, and primary model are configured.
- The default model handles ordinary first-pass drafts.
- Sensitive-topic flags or a provider-requested escalation can select the escalation model.
- Very large bounded context can select the long-context model.
- Gemini or OpenAI may be configured as audited fallbacks for authenticated production flows.
- A provider failure returns a typed error or a clearly labeled deterministic fallback. The UI never labels fallback output as a successful Gloo response.

## Security and Human-Review Guarantees

- Provider credentials never enter client components or response payloads.
- Guest feature flags grant no access to `/api/integrations`, Settings, Command Center, or Camp routes.
- Gloo receives prepared context in a generation request, not direct database credentials or unrestricted retrieval access.
- AI output cannot approve itself, publish itself, send communication, diagnose a person, or decide pastoral action.
- Communication and integration actions remain behind separate server routes and human-controlled permissions.

## Verification

Automated evidence includes:

- `lib/scripture/youversion.test.ts`
- `lib/scripture/gloo.test.ts`
- `lib/scripture/meridian-ai.test.ts`
- `lib/scripture/guest-reading-plan-route.test.ts`
- `lib/scripture/student-discussion-route.test.ts`
- `lib/competition/guest-runtime.test.ts`
- `lib/auth/student-route-access.test.ts`
- `tests/student-scripture-hub.spec.ts`
- `tests/unified-access-guest-mode.spec.ts`

Before submission, run the full validation sequence in the repository README and then exercise the production judge path. Capture one successful YouVersion lookup and one successful Gloo generation showing the returned provider/model badge; do not capture or expose request headers containing credentials.
