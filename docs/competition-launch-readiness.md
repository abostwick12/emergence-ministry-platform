# Competition Launch Readiness

Last audited: July 28, 2026

## Current State

Lead Emergence has a judge-ready hardening PR open at https://github.com/Lead-Emergence/emergence-ministry-platform/pull/308.

The PR is merge-clean and green on GitHub. The latest code-bearing commit with the Remotion finalizer is `1f0c3b88f144ebc82a08cd1acb9502151dc8d7b3`; later commits only update readiness documentation:

- `CI / Design check, typecheck, and lint`: passed.
- `Full CI / Build and E2E`: passed.

The current production deployment at `https://www.leademergence.com` is ready on Vercel, but it is still the pre-PR deployment. Do not treat the final judge guest path as production-verified until PR #308 is merged, production is redeployed, and `npm run verify:judge-path` passes against the production URL.

## Judge Guest Path

The intended public path is:

1. Open `https://www.leademergence.com/login`.
2. Select `Continue as guest`.
3. Review `/dashboard` for the total ministry operating rhythm.
4. Review `/ministry` for Ministry Hub, Meridian organizational memory, EMMA evidence, and culture-grounded decisions.
5. Review `/student/scripture/resources?reference=John%203%3A16` for YouVersion-grounded Scripture access.
6. Review `/student/scripture/questions` for Journey Journal: Receive, Explore, Practice, Walk, See.
7. Review `/discipleship` for Gloo AI Studio, Meridian context, safety labels, and leader approval.
8. Review `/hackathon` for the public ecosystem proof page.

## Verified Evidence

- Local production build passed with `npm run build`.
- Local production guest-path verification passed with `npm run verify:judge-path` against `http://localhost:3210` after `npm run build` and `npm run start`.
- The judge-path verifier now captures and verifies both desktop and mobile viewports, checks the final route destination to catch protected-route redirects, and includes form input values when verifying visible Scripture references.
- GitHub Full CI passed after the Remotion finalizer landed.
- Vercel preview build completed successfully, but preview URLs are protected by Vercel login and are not suitable as public judge links.

## Remaining Launch Risks

- Production is not on PR #308 yet.
- The public YouTube demo link is still required before submission.
- The GitHub repository link is in the writeup, but the repository is private as of July 28, 2026. Make it public or grant judge access before submitting the repo URL.
- The MP4 blank tail was fixed with the Remotion `ScriptureFrontiersFinalizer`; the expected Desktop submission filename now points to the fixed 178.112 second render. Still watch the final MP4 end to end before upload for stale branding, readable captions, audio, and unsupported claims.
- After production deploy, run the judge-path verifier against `https://www.leademergence.com` and inspect the generated desktop and mobile screenshots in `test-results/production-judge-path`.

## Post-Merge Release Steps

Run these after explicit merge approval:

1. Merge PR #308.
2. Pull the updated `main` locally.
3. Deploy production with Vercel.
4. Confirm `https://www.leademergence.com` points to the new deployment.
5. Run `npm run verify:judge-path` with the default production URL.
6. Update the Desktop submission checklist with the deployment result.
7. Insert the final public YouTube link into the writeup and confirm the GitHub repo is public or judge-accessible.
