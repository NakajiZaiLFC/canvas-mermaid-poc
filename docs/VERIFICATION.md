# 検証記録

検証日: 2026-11-05 / macOS / Node24.11.1 / Chrome156.0.8078.80。

## 実行済み

- TypeScript型検証: 成功。
- ESLint: 成功。
- Vitest: 13テスト成功（同一ソースの図を削除したときのID取り違え回帰を含む）。
- Vite本番ビルド: 成功。大きな遅延読込チャンクと初期エディターチャンクにサイズ警告あり。
- npm audit: 開発依存を含め0件。minimatchの開発依存を修正版にoverride。
- 本番ブラウザ: レビューとOS共通Redoの回帰を含む20ケース成功。性能計測1ケースは別実行で成功（通常回帰では意図的にskip）。

## 公開環境

- [GitHub Actions](https://github.com/NakajiZaiLFC/canvas-mermaid-poc/actions/runs/42035722069): b46561d5ce770f656009ccb00a3f5b8f6fbc4740。Linuxで型・Lint・単体13件・ビルド・ブラウザ20件を通過しPagesへデプロイ成功。
- [公開デモ](https://nakajizailfc.github.io/canvas-mermaid-poc/): HTTP200とサブパスの資産取得を確認。
- `TEST_URL=https://nakajizailfc.github.io/canvas-mermaid-poc/ npm run test:e2e`: **20 passed (25.5s)**。AIのモデル応答だけはテスト内で差し替え。他は実際の公開資産・IndexedDB・Mermaid描画を使用。
- 性能計測の1ケースは通常回帰で意図的にskipし、ローカル本番ビルドで別実行済み。公開サイトの遅延としてローカル実測値を報告しない。
- 公開後の1920×1080スクリーンショットを目視確認。固定ツールバー・別プレビューなし、本文・日本語ラベルの欠落なし。
- A4説明原稿PDFは最終更新後に1ページ、A4寸法と日本語・URLをレンダリング画像で確認。
- CIにはActionsのNode20非推奨（Node24へ自動移行）とubuntu-latest移行の警告が残ります。ジョブは成功。今後の保守時にActionsの新しいメジャーへ更新する。

## テストと証拠の範囲

| 対象 | 状態・内容 |
|---|---|
| A 基本編集 | 成功。キーボードだけで見出し・説明・図・後続文章を作成 |
| B 図変更 | 成功。未変更の別図のSVG IDを維持 |
| C 構文エラー | 成功。直前の図を保持しUndoによる復帰も確認 |
| D AI生成 | 実アダプター実装済み。モデル応答置換のE2Eで検証・承認・挿入・Undo成功。実モデル未検証 |
| E AI修復 | 実アダプター実装済み。応答置換E2Eで修復・差分・承認・Undo、競合拒否、取消成功。実モデル未検証 |
| F 画面共有 | 1920×1080を画像確認。1366・900幅でリサイズ検証、400幅で図の縮小率下限と横スクロールを検証 |
| G 保存 | 複数図・空文書の復元、原文書出し、未知記法と不正ソースのインポート、保存失敗時の書出し成功 |
| H 回帰 | 型検証・Lint・Vitest・ビルド・Playwrightを実行 |
| IME | compositionイベントによる表示固定のみ自動検証。OSの実IME変換・候補選択は未検証 |
| 安全性 | 生HTML・Mermaidラベルからのスクリプト非実行と外部画像非取得をブラウザで検証 |

AIハーネスのテスト応答は `tests/ai.spec.ts` とVitestテストにだけ存在し、本番コードに固定応答はありません。

## 性能計測の定義

本番ビルド、1920×1080、CPU制限なし、ローカル配信。
文書更新を受けた描画要求時点から、対象SVG反映後のrequestAnimationFrameまで（80msデバウンス込み）。
物理ディスプレイへの表示を外部カメラで測定した値ではなく、ブラウザ内の描画フレーム到達までの値です。
Flowchart10ノードとSequence Diagram4参加者のラベルを各30回変更し、中央値・p95・最大を記録します。
初回の依存ロードは別計測。目標は温間時p95<=200ms、300ms超では原因調査。

| 図 | 回数 | 中央値 | p95 | 最大 |
|---|---:|---:|---:|---:|
| Flowchart / 10ノード | 30 | 128.8ms | 132.8ms | 133.5ms |
| Sequence Diagram / 4参加者 | 30 | 104.3ms | 109.5ms | 111.2ms |

初回サンプル描画:350.2ms（依存の初回読込・初期化を含む）。生データは[performance.json](performance.json)。
温間時の目標内。初回のロード・初期化が温間時より遅く、入力処理には依存させていません。
Widget再生成の重複計測を修正し、30入力=30サンプルを確認しました。

## 実際のAI利用可否

隔離したHeadless Chrome156ではLanguageModel APIは存在しますが、ja/enを指定したavailabilityは unavailable でした。
ユーザーの通常Chromeプロファイルを確認した結果ではありません。モデルはダウンロードしていません。
手元のディスク空き容量は約15GiBで、公式の初回導入要件22GBを下回っていました。
実モデルの日本語生成・修復品質・ダウンロード経路は未検証です。

## レビュー

独立した読み取りレビューで、削除した図のIDが同一ソースの別図へ移る問題と、保存停止警告がインポート通知で隠れる問題を検出。
両方を回帰テストで再現し、IDの一対一対応と保存通知の分離で修正しました。

Linux CIのRedo失敗を、ローカルでLinux/Windowsのnavigator.platformを使って再現しました。トランザクション記録で、テストの`Shift+z`が小文字イベントとなり2回目のUndoを実行していることを特定。実キーボードに対応する`Shift+Z`へ修正し、3種類のキー設定で回帰成功。Playwrightのキー指定は大文字小文字を区別します（[公式Keyboard API](https://playwright.dev/docs/api/class-keyboard#keyboard-press)）。Windowsでも案内したRedoを使えるよう、アプリにはMod+Shift+Zを明示的に割り当てています。キー設定の模擬テストをWindows実機検証とは扱いません。

## 未検証・制約

- 実Chrome端末内モデルによる日本語生成・修復。
- ネイティブ日本語IME。Work設定で既存ChromeのCUA操作が無効。
- 実利用者テスト、Zoom/Meet/Teamsの受信側での見え方、効果改善率。
- 大規模図のフレーム時間、Chrome以外のブラウザの完全検証。
- 公式一次審査書式の適合。A4原稿は主催者テンプレート照合前。

画面共有相当のローカルレイアウト確認を、実際のオンライン会議検証として報告しません。

[公開環境を1920×1080で確認した画面](screenshots/canvas-desktop.png)

## 2026-11-06: completion, recovery and shared cloud AI

User approved shared cloud AI, replacing the previous local-only scope. Cloudflare OAuth renewed successfully and dedicated Worker deployed as `bf2362cb-1615-4614-ba50-c134853b3ca9` at `https://canvas-mermaid-ai.arka-dia-wombox.workers.dev/ai`. No paid-plan upgrade or disk cleanup was performed.

- `npm run check`: typecheck, lint, **33 unit tests**, production build passed after review fixes.
- `npm run test:server`: **1 real SQLite/Miniflare runtime test** passed, checking concurrent reservations, global budget and delayed-alarm protection. This does not mock Durable Object storage.
- Production browser regression before review fixes: **27 passed**, performance opt-in skipped. Local AI model boundary and cloud response boundary are deliberately simulated in ordinary CI.
- Fresh independent review found three Important bugs: direction completion deleting same-line edges; recovery inherited by a replacement block; editing during hydration losing recovery. Each was reproduced with a failing test and fixed; focused14 cases passed. Existing headers now use keyword completion rather than inserting sample nodes.
- A stale-repair browser case intermittently failed when relying on native DOM selection restoration after focusing the editor container. The test now explicitly chooses the Mermaid source line and asserts the actual change before approval. Review found no defect in the identity/source guard; focused repeats plus full suite confirm intended behavior. No unsupported production focus patch was introduced.
- A staged live-browser attempt overlapped a production rebuild and failed due to a removed asset filename; subsequent tests use a fixed build. This is test orchestration failure, not model success evidence.
- Direct live API probe: HTTP200 in2225ms, but returned invalid Mermaid (`-->|アクセス|>`). Therefore API200 alone is explicitly NOT recorded as successful generation. End-to-end validation/retry results follow separately.

Unverified: native OS Japanese IME candidate selection, actual local Chrome inference, real-user usability effects, formal organizer template compliance. Controlled storage failure is tested; actual browser disk/quota exhaustion was not induced. Anonymous public quota exhaustion remains possible by design; billing amounts are not inferred from the reservation counter.

### Real model E2E, staged production build

`LIVE_AI=1 LIVE_STAGED=1 TEST_URL=https://nakajizailfc.github.io/ npm run test:e2e -- tests/live-ai.spec.ts`: **1 passed**, Nov6. This test served the frozen production frontend under its approved Origin and used the deployed Cloudflare endpoint without replacing model responses.

- Japanese generation: candidate in **2362ms**, one request. Model returned a valid sequence diagram with 利用者 → Web → API → DB, requested nodes/connections retained.
- Repair: candidate in **1934ms**, one request. Removing injected `broken ` from the original flowchart retained `U[利用者] --> W[Web]`, `W --> A[API]`, `A --> D[(データベース)]`.
- Both went through real Mermaid validation/rendering, explicit approval, document application and Undo. Existing sample prose remained. Invalid source retained its prior diagram until approved repair.
- These two successful tasks did not require automatic retry. Earlier isolated API probe returned invalid Mermaid; the model is not guaranteed to succeed. Automated harness tests cover invalid output/retry/refusal separately.
- Times are individual observations, not statistical AI latency benchmarks. Test deliberately waited61seconds between tasks to respect rate limits.

### Reviewed final regression and performance

`CLOUD_TEST=1 PRODUCTION_TEST=1 MEASURE=1 npm run test:e2e`: **28 passed** (27 functional +1 performance), real-AI opt-in1 skipped. Production at1920×1080, each diagram30edits,80ms debounce included:

| Diagram | median | p95 | max |
|---|---:|---:|---:|
| Flowchart10nodes |126.4ms|134.2ms|134.7ms|
| Sequence4participants |104.8ms|108.5ms|109.5ms|

Initial sample308.6ms. Chrome156/macOS; local AI availability remains unavailable. Values measure document change to SVG paint frame, not network AI time. Tested readable overflow and unchanged neighboring SVG identity. Native screen-sharing recipient evaluation remains unperformed.

### Deployment

Frontend commit `f67320d0f63f1eebac7357a1090933ca12767bad` deployed successfully through [GitHub Actions42171299520](https://github.com/NakajiZaiLFC/canvas-mermaid-poc/actions/runs/42171299520). Linux CI passed33unit,1SQLite runtime,27browser cases; real-AI/performance opt-ins skipped. Public HTML returned200 and includes the actual Worker origin in CSP and Pages-prefixed assets. The frontend uses repository variable `CANVAS_AI_ENDPOINT`; no browser credential is present.

The updated PDF was regenerated, confirmed A4/1page with pdfinfo, and visually inspected as a PNG. Official template correspondence remains unverified.

### Live public site final acceptance

`CLOUD_TEST=1 LIVE_AI=1 TEST_URL=https://nakajizailfc.github.io/canvas-mermaid-poc/ npm run test:e2e`: **28 passed** (27 regression +1 real-model E2E), performance1 skipped. Actual published assets and deployed Worker used, no staged asset substitution. Generation2473ms and repair1860ms, one real request each. Output retained the expected four participants/connections; candidate validation, approval, insertion/replacement, unchanged prose and Undo passed. Public desktop screenshot at1920×1080 visually inspected.

Final handoff: code-based follow-up tasks complete and deployed. Deferred verification: native Japanese IME, actual local model (optional), induced real storage exhaustion, third-party user study and organizer-provided template compliance. No Critical review findings remain; all three Important findings fixed. The reviewer’s optional quota-exhaustion coverage remains deferred; synthetic QuotaExceededError behavior is covered.

### 2026-11-06: native IME investigation (in progress)

- macOS27.0.1 / Chrome156.0.8078.80: after the user selected Hiragana, native key presses produced `かんじ` → `感じ`. Trusted composition/input events were observed. This is partial native evidence, not a full acceptance pass.
- Candidate-list selection and Undo after commit are still unconfirmed: native automation timed out before the final state could be observed. Do not infer success from synthetic composition tests or Japanese text insertion.
- User clarified a separate failure: manual typing in the ChatGPT in-app browser produces Latin letters rather than Japanese composition.
- Inspected the affected in-app Canvas document: Chromium156 UA, `contenteditable=true`, no attached EditContext. Installed CodeMirror6.43.15 only enables its EditContext path on Android. Disabling EditContext would not address the observed Mac path and was not applied.
- Prepared a temporary local-only comparison page at `http://localhost:4173/ime-check.html` with a plain textarea and plain contenteditable, no Canvas dependencies. It reports input-event metadata in page memory only, with no storage or external transmission. Waiting for the user's manual comparison to distinguish the browser input bridge from Canvas handlers. This page is an untracked build artifact, not part of the published app, and is removed by the next build.
- No application-code fix or new deployment has been made for this report. The in-app root cause remains unconfirmed.

Follow-up observations:
- User confirmed both the plain textarea and plain contenteditable accept Japanese in the in-app browser. Observed trusted compositionupdate/insertCompositionText events on the comparison page. User also confirmed regular Chrome accepts Japanese, while the published Canvas in the in-app browser still produces Latin letters.
- The first Canvas trace was lost when its local tab was closed and the public URL opened. The next window-property observer did not retain its buffer; its empty result is NOT evidence of absent composition. A DOM-backed observer was verified with a diagnostic F16 event and attached to the public tab for the next manual input. No document text was altered by the observer.
- Isolated Chrome / local production build: CDP Input.imeSetComposition through `か`, `かん`, `かんじ`, `漢字`, followed by Input.insertText to commit, produced `漢字`. Cmd+Z removed the committed text and retained preceding prose. This is browser-protocol composition evidence, not a native Mac candidate-menu test or an in-app-browser pass. Initial sandboxed Chrome launch failed; the authorized isolated rerun succeeded.
- Native key delivery through the ChatGPT host application is unavailable: the Computer Use tool rejected access to that application. Manual in-app input is needed to observe this specific route.

Investigation closure by user decision (Nov6): the user confirmed Japanese input works in regular Chrome, then explicitly requested proceeding without further investigation. Treat Chrome Japanese input as accepted for this PoC. Do not claim native candidate selection/Undo or in-app compatibility passed. The DOM-backed observer caught its synthetic diagnostic probe but did not capture subsequent manual input despite visible document changes; therefore the instrumentation cannot establish which input events reached Canvas. Root cause remains unresolved. No application input-path change was made. The public tab's temporary observer/attribute was removed, the separate diagnostic server stopped and comparison-page files removed. Deferred IME checks are no longer submission blockers.
