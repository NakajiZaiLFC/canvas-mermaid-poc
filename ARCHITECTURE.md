# Architecture

## One document, one history

CodeMirror6のMarkdownテキストが唯一の文書状態。Reactはマウントと一時UIだけを管理します。
Tiptap/ProseMirror＋内包CodeMirror案も比較しましたが、Markdown変換、選択、二重履歴を同期する負担を避けるため、CodeMirror Decoration方式を採用しました。
SSRは不要なのでViteを採用し、任意のクラウドAIは独立したWorkerへ分離します。

| 責務 | 実装 |
|---|---|
| 入力・履歴・操作 | `src/editor/createEditor.ts` |
| Markdown構造・図の位置追従 | `src/editor/document.ts`、Lezer構文木 |
| Live Preview・図Widget | `src/editor/preview.ts` |
| 検証・SVG生成 | `src/diagrams/mermaid.ts` |
| スケジューリング・世代・キャッシュ | `src/diagrams/renderer.ts` |
| AIアダプター・検証・承認UI | `src/ai/` |
| 保存 | `src/persistence.ts` |
| 一時操作UI・初期化 | `src/App.tsx` |

## Rendering and input

Markdownの整形はDecorationで行い、原文は書き換えません。縦方向の寸法を変えるブロックDecorationはStateFieldから直接提供します。
Mermaidブロックはトランザクションの位置マッピングで識別子を維持し、同じ内容の複数図も区別します。
編集中は同じブロックにソース＋図、非編集中は図だけを表示します。

図のソース変更後80msで描画キューに入れ、構文検証→SVG生成→無害化→対象Widget更新を実行します。
新しい世代が来たら古い成功・失敗結果を捨てます。直前の正常な図はエラー中も残します。
同じ図の未変更ソースは再描画せず、64件までのソース別結果をメモリにキャッシュします。
文書の走査は更新時に行いますが、構文解析はLezerの増分処理、図の描画は変更ブロック単位です。

MermaidのDOM計測はメインスレッドで実行されます。80ms待ちと描画キューは入力イベントから処理を分けますが、巨大図のCPU処理をWorkerへ隔離するものではありません。
そのため文字数・エッジ数に上限を設けます。性能の実測は検証記録に残します。

IME変換中はDecorationを位置マッピングだけで維持し、構造置換・図の描画要求を確定まで保留します。
図の幅変更はResizeObserverから次フレームへ回し、幅が同じ通知は無視します。
本文22px、図の基本ラベル20px、図の縮小率下限0.8。収まらない場合は図内の横スクロールを利用します。

## AI boundary

`AITask`は`generate(instruction)`または`repair(source,error,instruction)`。
公開版は設定済みの共用クラウドを既定とし、端末内Chrome AIも明示選択できます。どちらも送信・準備ボタンを押すまで推論しません。
応答はJSON `{code: string}` に制約し、サイズ・形・Mermaid構文・実描画を検証します。検証失敗の再試行は一度です。
候補は承認後だけ一つの編集トランザクションとして適用します。モデルには全文書を渡しません。

生成位置は文書変更に追従し、削除された位置への適用は拒否します。修復はブロックIDと元ソースの一致を確認します。
AbortSignalで取消・180秒タイムアウトを管理し、終了時にモデルセッションを破棄します。
クラウドは固定Workerエンドポイントのみ。AIに任意JavaScriptの操作APIは提供しません。

## Storage and security

IndexedDB `canvas-mermaid-v1` / `documents` に `{version:2,revision,markdown,recovery,savedAt}` を保存します。
書き込みを直列化し、空文字と未保存を区別します。読込エラーや未知の形式は上書きしません。
保存失敗時も編集・書き出しを維持します。インポートの改行はLFへ統一します。
最後の正常な図のソースを保存し、不正なソースの再読込時に検証して再描画します。SVGは永続化しません。初期のブロックIDに結び付け、削除・置換後の図へ回復情報を流用しません。

生HTMLはテキストとして扱います。Mermaid strict、DOMPurify SVGプロファイル、リンク・外部画像禁止、CSPを重ねます。
設定ディレクティブ・frontmatter・画像定義は拒否し、元ソースを残して理由を表示します。
アプリは全資産を同じ配信元から読み、CDNフォントや分析SDKは使いません。

## Deliberate limits

複数タブ競合のマージ、完全オフライン起動のService Worker、複数ファイル、全Markdown仕様の整形は範囲外です。
更新250ms以内の強制終了では最新入力を失う可能性があります。通常の非表示化時に保存を試み、重要文書は書き出しを案内します。
公開はソースの公開とWebアプリの無料提供であり、OSSライセンス付与は別判断です。

## 2026-11-06: input assistance / durable recovery / shared cloud AI

This section supersedes the original device-only AI and last-writer-wins persistence decisions, following explicit user approval of shared cloud AI.

- `editor/completion.ts`: CodeMirror completion source + snippets + transient ghost decoration. Highest-priority Tab/Esc handlers; Enter remains normal editing; composition suppresses completion actions. No network dependency.
- `persistence.ts`: version-2 snapshots in the existing IndexedDB store, revision IDs checked atomically in readwrite transactions. `DocumentSession` serializes its own saves and rejects another tab's stale revision. Recovery is bounded source data, rerendered through the same sanitizer; no stored SVG injection.
- `diagrams/renderer.ts`: generation guards and last valid source; recovery draw cannot override a newer edit. Source and diagram layers retain independent lifecycle.
- `ai/cloud.ts`: fixed build-config endpoint, bounded request/response, abort signal. `AiPanel` discloses the selected provider and data before submission; no silent fallback. Existing harness validates and renders candidates before approval.
- `server/worker.ts`: exact-origin CORS, bounded JSON input, fixed Workers AI model `@cf/meta/llama-3.3-70b-instruct-fp8-fast`, JSON schema, output bounds and timeout. The server does not execute AI code or store document text.
- `DailyBudget` SQLite Durable Object: one atomic global budget, UTC-day rotation and per-IP limits with daily salted hashes. Reservations occur before inference and are not refunded. Delayed alarms cannot erase today's budget. Request errors fail closed. `server/runtime.spec.ts` exercises real SQLite concurrency via Miniflare.
- `vite.config.ts`: adds only configured AI origin to connect-src. AI credentials stay in the Worker binding, never in frontend builds or repository variables.

Rationale: static frontend retains fast local editing; optional inference is shared server-side so judges and visitors need no model installation. Cost/abuse limits deliberately restrict the anonymous PoC. CORS is not authentication; determined callers can consume the shared quota. Local AI remains an explicit alternative, with actual availability unverified.
