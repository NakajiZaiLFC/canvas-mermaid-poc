# Current status

2026-11-05: basic editor and local AI integration implemented; local production checks passed. GitHub Pages deployment in progress.

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
- Typecheck, lint, build,13unit tests and17production browser regression tests passed. One opt-in performance test separately passed.
- Measured flowchart10nodes p95 132.8ms; sequence4participants p95 109.5ms (30edits each,80ms debounce included).
- Independent code review:2important issues reproduced and fixed with tests. No deferred minor findings.
- A4 one-page draft PDF created; final URL and last validation count will be refreshed after publish.

## Publication

- Source: https://github.com/NakajiZaiLFC/canvas-mermaid-poc
- Branch: feat/canvas-poc
- GitHub Pages configured for Actions. Intended URL: https://nakajizailfc.github.io/canvas-mermaid-poc/ (verify before reporting live).
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
- No real user tests or measured improvement rate. A4 document is a draft, not verified against organizer template.
- Editor PoC is ready for hands-on checking. Full AI-based submission readiness remains conditional on a real model test and judge-compatible device.

## Resume

1. Read README, ARCHITECTURE and docs/VERIFICATION.md.
2. Run npm ci and npm run check; run production browser tests as documented.
3. Check Pages workflow and public URL; resolve only actual failing steps.
4. On supported Chrome, open AI and test Japanese generation and repair; record actual availability, duration and resulting graph. Never replace this with mock results.
5. Perform native Japanese IME and user test; obtain official submission template, update docs/submission.html and regenerate PDF with node scripts/submission-pdf.mjs.

## Prerequisites
- Real Chrome AI availability unknown; disk ~15GiB below22GB initial model requirement.
- Native Chrome automation disabled in Work settings. Manual IME verification remains required.
- Official A4 submission template not supplied; draft cannot be called officially compliant.
