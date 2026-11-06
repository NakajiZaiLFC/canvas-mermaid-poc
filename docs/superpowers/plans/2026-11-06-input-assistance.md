# Input assistance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement task-by-task.

**Goal:** Immediate syntax suggestions plus durable diagram/error recovery and safe concurrent local saving.
**Architecture:** CodeMirror completion source and ghost decorations; snapshot persistence with atomic revision checking; Mermaid recovery sources rerendered through the existing validator.
**Tech Stack:** Existing React/TypeScript/Vite/CodeMirror/Mermaid/IndexedDB, autocomplete direct dependency.
**Spec:** docs/superpowers/specs/2026-11-06-input-assistance-design.md

## Global Constraints
- No automatic AI calls, cloud fallback, or fixed UI.
- Enter and IME keep normal input semantics. Tab accepts only visible completions, with snippet fields afterwards.
- Store source, never persisted raw SVG. Preserve losing-tab text after save conflict.
- Real AI, native IME and user testing remain evidence-gated.

## Review Focus
- Completion at a closing fence, prose URL, ordinary code, middle of a token, and unfinished fence.
- Esc/Tab/Enter while IME is composing and after a completion/snippet is dismissed.
- Undo removes an accepted suggestion in one step; ghost never appears in exports.
- Recovery for identical diagrams, moved/deleted blocks, unsafe source or invalid recovery records.
- Concurrent first writes/legacy data, corrupted records and storage quota failure.

### Task 1: Input assistance
Files: src/editor/completion.ts + tests, createEditor.ts, styles-editor.css, tests/completion.spec.ts, sample/help.
- [x] RED: source tests for trigger/context/identifier scope and browser tests for slash-to-diagram, ghost/Tab/Undo, Enter/Esc, composition.
- [x] Implement canvasCompletion(CompletionContext):CompletionResult|null and inputAssistance():Extension using official autocomplete/snippet APIs.
- [x] Verify focused tests, then full suites; document shortcuts.

### Task 2: Durable local document
Files: persistence.ts/tests, App.tsx, renderer.ts/tests, createEditor.ts, tests/recovery.spec.ts.
- [x] RED: version1 migration, stale revision rejection, concurrent first save; browser valid->invalid->reload keeps SVG and source.
- [x] Implement DocumentSession.load/save snapshot API; renderer last-valid source recovery and snapshot callbacks.
- [x] Verify conflict leaves other tab saved, loser exportable; recovery not shared across distinct diagrams.

### Task 3: Verify, publish, handoff
- [x] Full check and production/browser performance regression; independent review and fix findings.
- [x] Update README, ARCHITECTURE, CURRENT, verification and submission draft with evidence.
- [x] Commit/push under existing publication authorization; CI and public URL tests.
- [x] Clearly report only externally blocked verification; no claim that mocks prove real AI.

### Task 2b: Shared cloud AI (explicitly approved user change)
Files: server/worker.ts, server/budget.ts, wrangler config/tests; src/ai/cloud.ts/AiPanel.tsx; CSP build plugin; tests/cloud.spec.ts.
- [x] RED: reject foreign origins/oversize requests/exhausted budgets without model calls; validate provider response; cloud UI discloses submission and still requires candidate approval.
- [x] Build authenticated Workers AI binding with atomic daily budget; frontend endpoint from build config, local option retained, no implicit fallback or content submission.
- [x] Run unit and HTTP/browser boundary tests; package dry run. After concrete result, obtain expired Cloudflare OAuth login and deploy, test real Japanese generation+repair.
- [x] Auth completed; dedicated cloud endpoint and frontend published. Real model generation/repair verified on public URL; no simulated-model claim.
