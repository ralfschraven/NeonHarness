# Design QA

## Source visual truth

- Source: `C:\Users\ralfs\.codex\generated_images\01a01704-94b6-7323-ba0e-4488f1ec903e\exec-8c4d0bbd-0a2e-4aea-9d90-d9dcea1616ed.png`
- Source pixels: 1487 x 1058; standard-density raster.
- Selected direction: dark Operator Studio with a slim rail, timeline/activity surface, and a separate status-oriented work area.

## Implementation evidence

- Activity screenshot: `C:\Users\ralfs\Downloads\deepseek-harness-master\deepseek-harness-master\design-qa-implementation.png`
- Clean Chat screenshot: `C:\Users\ralfs\Downloads\deepseek-harness-master\deepseek-harness-master\design-qa-chat.png`
- Combined comparison: `C:\Users\ralfs\Downloads\deepseek-harness-master\deepseek-harness-master\design-qa-comparison.png`
- Browser viewport: 687 x 731 CSS pixels; device scale factor 1; implementation screenshots are 687 x 731 pixels.
- The source and implementation were normalized for visual review by scaling both to 731px high in the combined comparison; browser chrome was not included.
- State: dark theme, `planie` workspace, Activity selected, an active task visible in Activity; Chat was checked during the same task and contained assistant/user content without process rows, plus one compact live status line while the turn was running.

## Comparison

Full view: both surfaces use a dark workspace canvas, compact left navigation, a top session/status band, and a dense activity/timeline treatment. The implementation intentionally retains Harness's existing host chrome and uses its production trajectory ledger as the Activity surface.

Focused regions: the Chat transcript and Activity ledger were inspected separately. Chat shows user prompts and assistant replies, with a single `Thinking…`/`Working…`/`Updating context…`/`Retrying…` status when active; Activity shows the detailed assistant/tool operational records and live task progression.

Required fidelity surfaces:

- Fonts/typography: existing Harness UI typography and code-face tokens remain consistent across the transcript and ledger; long process labels truncate rather than overflow.
- Spacing/layout: the existing responsive layout keeps the composer docked and the Activity ledger scrollable; the narrow browser viewport omits the reference's wide status drawer by responsive constraint.
- Colors/tokens: the implementation keeps the dark navy/charcoal base, blue active state, and violet/orange ledger accents from the existing Harness theme, aligned with the reference direction.
- Image/asset fidelity: the selected reference remains the visual source; the new generated app mark is stored as a real raster/ICO asset rather than CSS artwork.
- Copy/content: the tab is named `Activity`, which communicates the destination for operational updates more clearly than `Trajectory`.

## Comparison history

1. Initial implementation left live process details and the `Deep diving...` status inside Chat. This was an actionable behavior mismatch for the requested uncluttered dialog.
2. Fixed by routing operational node kinds to Activity and filtering reasoning/tool blocks from assistant transcript rendering.
3. Refined the separation: Chat now restores one compact live status indicator without reintroducing individual process rows; `design-qa-chat.png` shows the clean transcript and `design-qa-implementation.png` shows the same task's detailed process timeline in Activity.

Transient connection-loss and boot messages were recorded during intentional server restarts while rebuilding. A final reload completed successfully, and no new console errors were present after the final reload; the remaining log entries predate the final evidence capture.

## Findings

- No actionable P0/P1/P2 findings remain for the requested process-separation behavior.

## Follow-up polish

- P3: when the desktop shell is converted from the current app-style launcher into a packaged native shell, the selected reference's always-visible right status drawer and wider desktop composition can be brought closer at large window sizes.

## Implementation checklist

- [x] Activity is the default view for newly opened sessions and the current Harness session is left on Activity.
- [x] Process rows no longer render in Chat.
- [x] Assistant replies remain in Chat, with reasoning-only and tool blocks excluded.
- [x] One compact live thinking/working status appears in Chat during an active turn.
- [x] Generated custom icon is available in PNG and ICO form and applied to the desktop/Start Menu shortcuts.
- [x] Client and web builds completed successfully.

final result: passed
