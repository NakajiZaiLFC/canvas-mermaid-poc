# Current status

2026-11-05: basic editor and local AI integration implemented; local production, Linux CI and published-site browser checks passed. GitHub Pages is live.

Approved: device-only AI; new public GitHub repository and GitHub Pages.
Plan: docs/superpowers/plans/2026-11-05-canvas.md

## Decisions
- Existing workspace is empty: initialize a dedicated repository on feat/canvas-poc; no second worktree is necessary.
- Use CodeMirror as sole Markdown/history source; React only owns surrounding transient UI.
- Chrome AI only for v1, no silent cloud fallback.

## Implemented and verified

- Same-canvas Markdown live preview; in-place Mermaid source and SVG; text below figures.
- Flowchart and Sequence Diagram; changed-block rendering; last-good diagram on error; stale-result protection.
- Unified undo/redo, keyboard creation, mapped figure identities, stable synthetic composition.
- IndexedDB save/restore including empty documents; Markdown import/export; persistent save failure warnings.
- Chrome AI adapter; candidate validation/rendering, one retry, preview/diff, approval, cancellation and stale-target rejection.
- Typecheck, lint, build, 13 unit tests and 20 production browser regression tests passed locally and on Linux CI. Published-site tests also passed all 20 cases. One opt-in performance test separately passed.
- Measured flowchart10nodes p95 132.8ms; sequence4participants p95 109.5ms (30edits each,80ms debounce included).
- Independent code review:2important issues reproduced and fixed with tests. No deferred minor findings.
- A4 one-page draft PDF includes live URL and final test count; page count and Japanese rendering checked.

## Publication

- Source: https://github.com/NakajiZaiLFC/canvas-mermaid-poc
- Branch: feat/canvas-poc
- Live demo: https://nakajizailfc.github.io/canvas-mermaid-poc/ (HTTP200 and20browser cases verified).
- Deployed source: b46561d5ce770f656009ccb00a3f5b8f6fbc4740; successful CI/deploy: https://github.com/NakajiZaiLFC/canvas-mermaid-poc/actions/runs/42035722069
- Subsequent documentation-only commits do not redeploy the unchanged application.
- Workflow runs tests before deployment. No API keys, server or account requirement in the app.

## Known limitations / submission decision

- Actual local model not verified: isolated HeadlessChrome156 exposes LanguageModel but reports unavailable for ja/en.
- Native OS Japanese IME conversion/candidate selection unverified; synthetic composition is not a substitute.
- User selected real-model validation on another supported Chrome device. Follow README's seven-step checklist; do not substitute simulated tests.
- Diagram configuration directives, external images and graphs exceeding30,000chars/300edges are rejected with source preserved.
- Last-good SVG is memory-only; reopening an invalid source has no previous SVG.
- Single-tab local document; last writer wins across tabs. Last250ms may be lost on forced termination.
- Other Mermaid forms and complete Markdown nesting are outside the tested scope.
- Initial and some lazy chunks exceed500KB minified; they are bundled locally, not fetched from third-party CDNs.
- No real user tests or measured improvement rate. A4 document is a draft, not verified against organizer template. Official public criteria and the submission gaps are recorded in docs/SUBMISSION.md.
- Editor PoC is ready for hands-on checking. Full AI-based submission readiness remains conditional on a real model test and judge-compatible device.

## Resume

1. Read README, ARCHITECTURE and docs/VERIFICATION.md.
2. Run npm ci and npm run check; run production browser tests as documented.
3. Pages deployment and published tests are verified; use the same workflow for future application changes.
4. On supported Chrome, open AI and test Japanese generation and repair; record actual availability, duration and resulting graph. Never replace this with mock results.
5. Perform native Japanese IME and user test; obtain official submission template, update docs/submission.html and regenerate PDF with node scripts/submission-pdf.mjs.

## Prerequisites
- Real Chrome AI availability unknown; disk ~15GiB below22GB initial model requirement.
- Native Chrome automation disabled in Work settings. Manual IME verification remains required.
- Official A4 submission template not supplied; draft cannot be called officially compliant.
