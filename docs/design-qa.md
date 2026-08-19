# NeonHarness visual QA

Reference: the selected NeonHarness brand direction supplied in the design brief.

## Checked states

- Collapsed rail: NeonHarness N mark, lime active control, steel navigation icons.
- Expanded sidebar: NeonHarness wordmark, uppercase New Session control, workspace/session list, and settings footer.
- Empty hero: N mark, `Build. Test. Deploy. Reliably.`, `NEON CORE`, workspace chip, and workbench composer.
- Typography and tokens: bundled Neon Display/Saira Semi Condensed and Neon Mono/JetBrains Mono assets load from the app, with the selected near-black/steel/slate/white/lime/amber palette.

## Evidence

- `corepack pnpm --filter @deepseek-ai/dsh-web-frontend run build` — passed.
- `corepack pnpm run build:lib:client` — passed.
- `corepack pnpm exec vitest run packages/client/ui-primitives/tests/icons.client.spec.tsx` — 75/75 passed.
- `corepack pnpm exec vitest run packages/client/ui-conversation/tests/skeleton.client.spec.tsx -t "Hero chrome"` — passed.
- Browser asset check — title `NeonHarness`, 2 logo marks rendered, Neon Display active, page background `rgb(11, 14, 17)`, lime accent `rgb(198, 255, 0)`.

The standalone preview emitted transient connection-retry messages during backend startup; the final rendered dashboard stayed available and visually stable after the backend settled.

Final result: passed
