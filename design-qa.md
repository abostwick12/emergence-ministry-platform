# Design QA

Reference:
- Lovable events card mockups from user attachments:
  - `C:\Users\AWBOST~1\AppData\Local\Temp\codex-clipboard-d241c5d6-58d4-4368-998a-0531d3b55a0d.png`
  - `C:\Users\AWBOST~1\AppData\Local\Temp\codex-clipboard-6eb08382-a55e-44bd-ab28-caa6e0130b0e.png`
- Lovable worship and budget mockups from user attachments:
  - `C:\Users\AWBOST~1\AppData\Local\Temp\codex-clipboard-d31ae8f3-b0ed-4698-b7e5-0c75ff597d3c.png`
  - `C:\Users\AWBOST~1\AppData\Local\Temp\codex-clipboard-1821707f-38d7-48e6-8c3b-b8ddaf6304a4.png`
- Cut-block references:
  - `C:\Users\awbostwick\.codex\codex-remote-attachments\019f5d52-ad9f-70d2-bb92-b495b765a756\41662CFD-10EB-4F85-8466-34C078A37847\1-Photo-1.jpg`
  - `C:\Users\awbostwick\.codex\codex-remote-attachments\019f5d52-ad9f-70d2-bb92-b495b765a756\41662CFD-10EB-4F85-8466-34C078A37847\2-Photo-2.jpg`

Prototype captures:
- `test-results/lovable-polish-events.png`
- `test-results/lovable-polish-events-card-region.png`
- `test-results/lovable-polish-worship.png`
- `test-results/lovable-polish-budget.png`
- `test-results/lovable-polish-emma-chat-fixed.png`
- `test-results/dashboard-editorial-1280x900.png`
- `test-results/events-editorial-1280x900.png`
- `test-results/worship-editorial-1280x900.png`
- `test-results/budget-editorial-1280x900.png`
- `test-results/student-editorial-1280x900.png`
- `test-results/discipleship-editorial-1280x900.png`
- `test-results/student-scripture-questions-editorial-1280x900.png`
- `test-results/events-editorial-768x1024.png`
- `test-results/dashboard-editorial-390x844.png`
- `test-results/student-editorial-390x844.png`

Viewport and state:
- Desktop viewport: 1280 x 900.
- Mock-auth app session.
- Routes checked: `/events`, `/worship`, `/budget`.

Checks:
- EMMA assistant sits directly under the large page header content on Events, Worship, and Budget.
- Events no longer show the old board/table as the primary experience; Lovable-style event cards load with tabs, create button, identity rail, scrollable summary tiles, and operations rail.
- Events card middle panel replaces Ministry Purpose with Scrollable Summary.
- Worship cuts the old Student worship schedule intro block and uses the Lovable service tabs, detail strip, setlist table, and team rail under EMMA.
- Budget cuts the old Budget Workspace intro block and uses Lovable action chips, metric cards, allocation overview, and ledger under EMMA.
- Page title double-neon lines are removed; only the intended single title accent remains.
- EMMA chat thread stays fixed-size and scrolls instead of expanding the whole assistant with every prompt.
- Event cards have no page-level horizontal overflow at the checked desktop viewport.
- Dashboard leads with decisions, permission-safe care signals, event readiness, and EMMA capabilities; unsupported volunteer and connection counts are absent.
- Compact EMMA briefs preserve an intentional expanded workspace and keep audit-safe/no-live-send language visible.
- Student Portal leads with the current question/journey and next step before reading progress, Scripture tools, community context, and history.
- Journey Journal progress is a single semantic list with one current step and computed `position: static`.
- Discipleship leads with student care and review, then formation signals; knowledge imports, resource packaging, video tools, and connection diagnostics are progressively disclosed.
- Worship advanced rehearsal, GroupMe, and ProPresenter tools remain functional and preview-only inside a labeled secondary workspace.
- The 390px and 768px captures retain readable single-column flow and approved internal rails without whole-page horizontal overflow.

Final result: passed.

## Mobile Lovable correction pass — 2026-07-14

Reference screenshots:
- Events filter and card: `C:\Users\awbostwick\.codex\codex-remote-attachments\019f629a-f634-75b1-8c4f-6be8d8700b27\3EDA96AF-6B8A-4F61-94D6-3607519EECC8\2-Photo-3.jpg`
- Events summary crowding: `C:\Users\awbostwick\.codex\codex-remote-attachments\019f629a-f634-75b1-8c4f-6be8d8700b27\3EDA96AF-6B8A-4F61-94D6-3607519EECC8\3-Photo-4.jpg`
- Misplaced Big Story video: `C:\Users\awbostwick\.codex\codex-remote-attachments\019f629a-f634-75b1-8c4f-6be8d8700b27\3EDA96AF-6B8A-4F61-94D6-3607519EECC8\4-Photo-5.jpg`
- How to Read module without inline video: `C:\Users\awbostwick\.codex\codex-remote-attachments\019f629a-f634-75b1-8c4f-6be8d8700b27\3EDA96AF-6B8A-4F61-94D6-3607519EECC8\5-Photo-6.jpg`

Implementation captures:
- `test-results/mobile-qa/events-top-390x844-final.png`
- `test-results/mobile-qa/events-card-390x844-final.png`
- `test-results/mobile-qa/discipleship-top-390x844.png`
- `test-results/mobile-qa/scripture-resources-390x844-final.png`
- `test-results/mobile-qa/how-to-read-module-390x844-final.png`

Viewport and state:
- In-app Browser viewport override: 390 x 844.
- Mock-auth staff session.
- Routes checked: `/events`, `/discipleship`, `/student/scripture/resources`, and `/student/scripture/how-to-read`.
- User references and implementation captures were emitted together in the same comparison inputs for Events and Scripture.

Checks:
- Events workspace computed styles are transparent with no background image, border, shadow, or backdrop filter. The filter rail remains horizontally scrollable and the page has no horizontal overflow.
- Event identity copy wraps naturally; summary values have a 239px readable tile width at the checked state; the operations rail resolves to one column on mobile.
- Discipleship leads with Discussion Review. Prep/access/diagnostics, Formation, and Administration are closed disclosures. Retrieved source-library cards render zero visible instances while their data remains available to interpretation logic.
- Generic Scripture resources render zero video iframes. The study-tool rail scrolls inside its own 310px container and no longer widens the page.
- How to Read renders seven lazy YouTube embeds inside their corresponding guide cards; the translation guide remains video-free because no direct matching BibleProject video was identified.
- React best-practices review found no new hook, accessibility, list-key, or component-structure violations.
- Camp and Command Center code and visual structure were not modified.

Final result: passed.
