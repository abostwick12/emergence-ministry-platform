# Lead Emergence Automated Platform

Lead Emergence is a Scripture-native ministry operating system. It connects the operational work ministry leaders already do with Scripture grounding, church-specific organizational memory, AI-assisted drafting, and explicit human review.

The central design question is not only, “How can a church manage ministry?” It is, “What would a shepherd want to notice?” Existing administration tools solve necessary stewardship problems. Lead Emergence adds a different layer: it helps leaders notice people, patterns, and questions that could otherwise remain invisible, without treating software or AI as pastoral authority.

- Production: [leademergence.com](https://www.leademergence.com)
- Judge walkthrough: [docs/Competition_Judge_Walkthrough.md](docs/Competition_Judge_Walkthrough.md)
- API usage and evidence: [docs/competition-api-usage.md](docs/competition-api-usage.md)
- Competition architecture: [docs/architecture/competition-runtime.md](docs/architecture/competition-runtime.md)
- Ecosystem proof: [docs/Competition_Ecosystem_Proof.md](docs/Competition_Ecosystem_Proof.md)
- Current functionality: [docs/current-functionality.md](docs/current-functionality.md)

## Competition Review Path

1. Open `/login` and select **Continue as guest**.
2. Open `/dashboard` for the operational ministry rhythm.
3. Open `/ministry` for Scripture-shaped ministry narratives, inspectable evidence, and Meridian context.
4. Open `/student/scripture/resources?reference=John%203%3A16` and select **Open Reader** to exercise the YouVersion passage lookup and Bible.com reader handoff.
5. Open `/student/scripture/plans/new` to generate a leader-review reading-plan draft. When guest AI is enabled and Gloo credentials are configured, this is a live Gloo AI Studio call.
6. Open `/student/scripture/questions` and `/discipleship` to inspect the student-question, safety, and leader-approval workflow.
7. Open `/hackathon` for a public summary of the ecosystem and its boundaries.

Every provider result names the provider/model that actually answered. Stock guest output remains labeled as stock output. No AI draft is automatically approved, published, sent, or written to an external ministry system.

## What the Platform Demonstrates

| Layer | Current implementation | Boundary |
| --- | --- | --- |
| Ministry operations | Events, generated tasks, assignments, budget visibility, communication previews, activity records, and a guest sandbox | Communication remains preview-only; external provider writes are not implied. |
| Meridian | Church mission, values, theology, history, rhythms, and current season shape the context presented to AI and leaders | Meridian provides context; it does not make pastoral decisions. |
| YouVersion Platform | Server-side passage lookup plus Bible.com reader links | Lead Emergence stores approved references and relationships, not fetched Bible text as permanent Meridian memory. |
| Gloo AI Studio | Gloo-first discussion and reading-plan drafting with model/safety metadata | Output is evidence and candidate material for leader review, not a verdict. |
| Human leadership | Review queues, safety labels, approval states, and audit language | Leaders retain responsibility for theology, care, teaching, and action. |

## Guest Runtime Controls

Guest access fails closed. These server-only variables enable the two judge-facing capabilities independently:

```dotenv
GUEST_AI_GENERATION_ENABLED=true
GUEST_SANDBOX_WRITES_ENABLED=true
```

| Variable | When `false` or absent | When `true` |
| --- | --- | --- |
| `GUEST_AI_GENERATION_ENABLED` | Guest generation routes return clearly labeled stock previews. | Guest Scripture routes may call the configured Meridian provider chain, with Gloo first. Drafts still cannot publish, send, or trigger external integrations. |
| `GUEST_SANDBOX_WRITES_ENABLED` | Guest mutation requests are rejected and editing controls remain disabled. | Events, tasks, budget items, Volunteer Hub actions, and selected formation records can change inside the visitor’s isolated guest sandbox. |

Important persistence boundary: the guest sandbox is session-scoped demo state, not canonical ministry storage. It is isolated by the guest session and may reset when the guest cookie, deployment, or server runtime resets. To permanently change what every judge sees by default, edit the canonical synthetic seed in `lib/guest/lead-emergence-demo-context.ts`, review the synthetic-data labels, and redeploy through the normal pull-request process.

Do not prefix either guest variable with `NEXT_PUBLIC_`. Provider credentials and runtime controls must remain server-only.

## Provider Configuration

Copy `.env.example` to `.env.local` and populate only the services needed for the environment. Never commit `.env*` files or credentials.

### YouVersion Platform

```dotenv
YOUVERSION_APP_KEY=
YOUVERSION_API_BASE_URL=https://api.youversion.com
```

The server sends the app key in `X-YVP-App-Key` and requests BSB Bible ID `3034`. The visible reader handoff uses Bible.com. See [the API guide](docs/competition-api-usage.md#youversion-platform-api) for the exact route and data boundary.

### Gloo AI Studio

```dotenv
GLOO_AI_CLIENT_ID=
GLOO_AI_CLIENT_SECRET=
GLOO_AI_BASE_URL=https://platform.ai.gloo.com/ai/v2
GLOO_AI_MODEL=gloo-openai-gpt-5-nano
GLOO_AI_ESCALATION_MODEL=gloo-openai-gpt-5-mini
GLOO_AI_LONG_CONTEXT_MODEL=gloo-google-gemini-2.5-flash-lite
```

Lead Emergence exchanges the client credentials for a short-lived bearer token, caches it server-side, and calls the Gloo chat-completions endpoint. Gemini or OpenAI can be configured as audited fallbacks, but Gloo remains the primary competition provider when its credentials are available.

### Supabase

```dotenv
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
```

Supabase Auth and Postgres are live production capabilities when configured. The service-role key is server-only. New projects use `supabase/schema.sql`; existing projects apply additive migrations from `supabase/migrations/` in order. Verify the target environment before any migration.

## Local Setup

Requirements: Node.js, npm, and Git.

```bash
git clone <repository-url>
cd emergence-ministry-platform-repo
copy .env.example .env.local
npm ci
npm run dev
```

Open `http://localhost:3000/login`. With no provider credentials, the application remains usable through deterministic local/guest fallbacks.

For non-production development auth:

```dotenv
ENABLE_DEV_AUTH=true
DEV_AUTH_ROLE=Administrator
```

`ENABLE_DEV_AUTH` is ignored when `VERCEL_ENV=production`. `E2E_MOCK_AUTH=true` is reserved for deterministic local/CI tests and must never be enabled in production.

## Required Validation

Run the repository checks before opening a pull request:

```bash
npm run design-check
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

Run `npm run test:unit` when changing provider, security, persistence, or business logic. Use `npm run verify:judge-path` against the final public deployment before submitting the competition entry.

## Architecture and Safety Rules

- External providers are called from server routes or adapter layers, never directly from browser components.
- Secrets and feature gates are server-only.
- Guest AI and guest writes are independent, opt-in controls.
- Guest writes are isolated from canonical ministry records.
- AI surfaces drafts, patterns, and evidence; it does not diagnose spiritual condition or decide pastoral action.
- Communication outputs remain drafts/previews unless a separate, approved human action sends them.
- Planning Center is the intended source of truth for future student and attendance data; Lead Emergence does not create a competing manually maintained roster.
- Stub or preview output must never be presented as a completed live sync or send.

## Current Scope

The operational vertical slice is:

**Create event -> generate baseline tasks -> assign and update tasks -> manage the event workspace -> preview communications -> view budget and integration activity -> retain an activity log.**

The competition layer adds Ministry Alignment, Meridian organizational context, YouVersion Scripture grounding, Gloo-assisted formation drafts, Journey Journal experiences, and leader review.

The repository does not claim that all planned integrations are live. Planning Center, Google Calendar, Google Drive, ProPresenter, and outbound communication behavior must be judged by the status shown in the application and the adapter documentation. A preview or stub is not a successful provider write.

## Repository Map

- `app/` - Next.js App Router pages and server routes
- `components/` - shared React UI
- `lib/` - auth, repositories, provider adapters, Meridian, and guest sandbox logic
- `supabase/` - schema snapshot and additive migrations
- `tests/` - Playwright end-to-end coverage
- `docs/` - competition, operations, and architecture documentation
- `archive/` - historical prototypes; not active application code

## Deployment

Vercel deploys production from `main`.

1. Start from the latest `main` and create a focused branch.
2. Run all required validation.
3. Open a pull request into `main`.
4. Review the Vercel preview and the guest path.
5. Merge only with explicit approval.
6. Add or confirm server-only production variables in the existing Vercel project.
7. Verify the deployed commit, provider badges, live guest generation, sandbox isolation, and `npm run verify:judge-path`.

Do not create a second Vercel project, expose secrets to the browser, run destructive tests against ministry data, or claim deployment verification without confirming the deployed commit.
