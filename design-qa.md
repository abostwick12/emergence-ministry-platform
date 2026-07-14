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

Final result: passed.
