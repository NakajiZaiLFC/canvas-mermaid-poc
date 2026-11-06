# Assistance expansion implementation plan

> **For agentic workers:** Use superpowers:executing-plans for native execution task-by-task.

**Goal:** Discoverable, context-aware, Japanese-searchable input assistance.
**Architecture:** Shared local template catalogue feeds CodeMirror completions and a searchable React command menu; CodeMirror applies snippets and owns history.
**Tech Stack:** Existing React/TypeScript/CodeMirror/Vite/Vitest/Playwright.
**Spec:** ../specs/2026-11-06-assistance-expansion-design.md

## Global constraints
No automatic cloud calls; no prose/label replacement without acceptance; keep Tab acceptance, Enter newline and IME suppression. No IME investigation restart.

## Review focus
- Middle-of-line edits preserve suffixes and unrelated paragraphs.
- Japanese/full-width/typo searches rank relevant candidates, not arbitrary prose.
- Mermaid suggestions are valid for their diagram family and scope.
- Search menu composition does not trigger insertion or AI execution.
- Insertion/Undo restores existing text and focus; error-retention behavior remains.

## Tasks
- [x] Add failing completion regressions for Japanese/typo/contextual identifiers, then implement shared catalogue and completion ranking/context. Files: src/editor/assistance.ts, completion.ts, completion.test.ts.
- [x] Add failing browser cases for visible searchable menu, template insertion/Undo, IME Enter guard; implement src/App.tsx, editor/createEditor.ts and styles.css. Keep contextual snippets at caret and root templates at block boundaries.
- [x] Verify all template sample diagrams parse/render; run check, server and production browser regression, inspect actual UI, update README/CURRENT/VERIFICATION and publish existing approved repo/Pages.
