# Current status

Assistance expansion (Nov6): 16 shared templates, Japanese/full-width/typo search, context-aware diagram snippets and targets, visible searchable Cmd/Ctrl+K menu. Review fixes protect prose suffixes and code-block boundaries; template insertion is one Undo group. 37 unit +1 SQLite runtime +36 production browser cases passed (1 real-model test intentionally skipped this run). Publication is being updated; see the latest verification entry.

IME follow-up (Nov6, accepted for PoC): user confirmed Japanese input works in regular Chrome and explicitly directed us to stop this investigation and proceed. Native Chrome conversion and isolated CDP composition/commit/Undo have partial evidence; native candidate-menu selection and native post-commit Undo remain unverified, but are not submission blockers. Manual input in ChatGPT's in-app Canvas remains a reported compatibility limitation; use regular Chrome. Diagnostic observation was removed from the public tab, the diagnostic server stopped and temporary comparison pages removed. No application-code fix was claimed or applied.

2026-11-06: input assistance, durable diagram recovery, conflict-safe persistence and explicitly approved shared cloud AI implemented. Published and verified, including actual cloud generation/repair on the live URL. Consult the dated verification entries for details.

## Decisions and authorization

- Dedicated repo / branch `feat/canvas-poc`; public GitHub and Pages already authorized.
- User explicitly chose shared cloud AI on Nov 6, superseding the original device-only decision. No disk cleanup or paid plan upgrade performed.
- CodeMirror remains sole Markdown/cursor/history source; React owns transient dialogs. Completion is deterministic/local; AI requires explicit action.

## Implemented

- One-canvas Markdown/Mermaid editing; flowchart and sequence; last-valid rendering, stale-generation protection, undo/redo, bounded safe rendering.
- Slash commands, inline ghost suggestions, Mermaid headers/directions/arrows/current-diagram identifiers, Tab snippets and Esc dismissal; Enter remains newline.
- IndexedDB revision conflicts stop stale writes and preserve losing-tab text. Last valid source survives invalid-source reload; recovery is scoped to original block identity and carried across pending edits.
- Cloudflare Workers AI generation/repair with data disclosure, validation/retry, preview/diff, approval, cancellation and stale-target rejection. Local Chrome AI remains selectable.
- Dedicated Worker: https://canvas-mermaid-ai.arka-dia-wombox.workers.dev/ai
- Model: @cf/meta/llama-3.3-70b-instruct-fp8-fast. Hard per-IP/global daily budget; no prompt storage or browser API keys. `ENABLED=false` disables AI.

## Publication

- Repo: https://github.com/NakajiZaiLFC/canvas-mermaid-poc
- Demo: https://nakajizailfc.github.io/canvas-mermaid-poc/
- GitHub variable CANVAS_AI_ENDPOINT configured; workflow verifies then publishes.
- Server revision bf2362cb-1615-4614-ba50-c134853b3ca9 deployed Nov 6. Frontend rollout and real AI final results are recorded below.

## Remaining evidence gates / limitations

- Chrome Japanese input accepted by the user. In-app-browser compatibility, native candidate selection and native Undo follow-up are deferred by explicit user decision, not submission gates.
- Local Chrome model actual inference unverified; cloud is intended to remove that prerequisite for visitors.
- No real user study or measured reduction in explanation time. Official A4 submission template not supplied; PDF is a draft, not confirmed compliant.
- Last250ms may be lost on forced process termination. Conflict recovery requires exporting/merging the losing tab.
- Anonymous attackers can consume shared quota; CORS is not authentication. NAT users share IP limits. Cloud/provider outages or quota exhaustion leave basic editing available.
- Other Mermaid forms, complex Markdown nesting and very large diagrams remain outside formal test scope. Some bundled chunks exceed500KB.
- Chrome extension, AI predictive typing, collaborative editing, account/cloud sync, multiple documents and training intentionally omitted.

## Resume

Read README/ARCHITECTURE/docs/VERIFICATION. Reuse the published app and dedicated Worker; no implementation change was needed for the IME acceptance decision. Obtain the organizer template and finalize submission. Do not reopen the deferred IME investigation unless requested. For future code changes, run npm run check, npm run test:server and relevant production browser tests. Real AI tests require LIVE_AI=1 and intentionally send synthetic examples; never report mocks as model evidence.

## Nov6 completed verification

- Reviewed code: type/lint/build and33unit tests passed; real SQLite budget integration1passed.
- Actual deployed cloud model: staged-production browser E2E passed generation2362ms and repair1934ms, including validation, approval, application, prose preservation and Undo. No local model installation was required. Exact prompts/results are documented in docs/VERIFICATION.md.
- Independent review: three Important correctness issues reproduced and fixed; focused14regressions passed. Actual quota exhaustion and native IME remain unverified.
- Final reviewed production browser run:27functional+1performance passed, real-AI opt-in skipped (run separately above). Flowchart p95=134.2ms; sequence p95=108.5ms; initial308.6ms at1920×1080.
- Frontend f67320d0f63f1eebac7357a1090933ca12767bad deployed successfully. CI https://github.com/NakajiZaiLFC/canvas-mermaid-poc/actions/runs/42171299520 passed33unit+1runtime+27browser cases. Public HTML200 and endpoint CSP verified; PDF A4/1page visually checked.
- Final public acceptance:28passed (27regression+1real-model E2E). Public generation2473ms, repair1860ms, one request each; validation/approval/Undo/prose preservation passed. Performance opt-in skipped here because measured separately.
- The web editor and AI demonstration are ready for judges to try. Formal submission remains subject to organizer-template matching and actual submission; native IME and real-user evaluation remain unverified. Current docs-only updates do not redeploy unchanged code.
