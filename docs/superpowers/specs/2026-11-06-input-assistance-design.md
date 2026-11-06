# Input assistance and editing durability

User request: predict useful input like Copilot and reveal syntax from typed triggers; finish remaining work autonomously. Earlier constraints remain: one canvas, no always-visible UI, no implicit AI requests, local-only AI. Implementation choices below are agent decisions within that authorization.

## Approach

Use CodeMirror's completion picker plus an inline, non-document suffix preview. Local syntax snippets are immediate and work without a model. Always-on LLM predictions would introduce model availability/latency into normal typing and contradict explicit-only AI. Full natural-language generation stays in the existing explicit AI panel.

- `/` at a prose line start offers Japanese/English searchable headings, lists, bold, inline code, code, flowchart and sequence snippets.
- A partial Mermaid fence offers complete figure templates. Inside a figure, complete diagram headers, directions, arrows and identifiers already used in that figure. No arbitrary prose guessing.
- Tab accepts a visible candidate; arrows choose; Esc dismisses. Enter always keeps its editing meaning. Snippet fields use Tab/Shift+Tab after acceptance. No completion during IME; no unintended Tab insertion while composing.
- Ghost suffix is gray, one-line, decorative, excluded from document/export/history; hidden during composition and for nonmatching prefixes. Lists are transient and keyboard accessible.
- Keep existing editor focus/history and changed-block drawing behavior.

## Remaining code work

Persist bounded last-valid Mermaid sources together with the Markdown snapshot. On restore, rerender and sanitize those sources; never trust persisted SVG. Match recovery to the exact current source and block offset. Distinct identical diagrams remain distinct. Cache failures must not discard a valid current figure.

Use an atomic IndexedDB revision comparison to reject stale writes from other tabs. Preserve both the stored winner and the losing tab's editable/exportable document; show persistent reload/export guidance. Read old version1 records without data loss.

## Verification boundary

Actual model testing was assigned by user to another supported Chrome device. Ask for outcome without blocking code work. Native OS IME/user interviews/official submission format require real evidence and cannot be marked done from synthetic tests. Do not add cloud fallback, broaden original non-goals, or invent results.

## Approved change: shared cloud AI (2026-11-06)
User explicitly chose shared cloud AI to avoid model installation for visitors. This supersedes local-only AI, but not local editing or explicit invocation. Disk cleanup is paused; nothing deleted.

Use a separate Cloudflare Worker with Workers AI binding (no API key in browser), existing Pages frontend, explicit cloud/local selector and per-run external-processing disclosure. Default to cloud only when a configured endpoint exists. Current Cloudflare OAuth is expired; prepare and verify the whole implementation before requesting login for deployment. No paid-plan upgrade without separate authorization.

PoC server: fixed Llama3.3-70B-fast model with JSON schema response, request body<=48KB, prompt<=24KB UTF-8, output<=1536 tokens. Durable Object atomically reserves daily global50requests, global40000 conservative token units, per-IP10requests/day and2/minute. Each inference/retry consumes a reservation; errors/cancels do not refund. No content logging or persistence. Store only counters and daily salted IP hashes; reset UTC and expire with an alarm. Limits may block legitimate users behind the same NAT; anonymous access cannot be abuse-proof.
