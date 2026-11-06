# Canvas

考えたことを文字にするだけで、その場で文章と図にする、画面共有用Markdown + Mermaidエディター。

**[アプリを開く](https://nakajizailfc.github.io/canvas-mermaid-poc/)** · ログイン不要。文書はブラウザ内に保存します。

## 起動

Node.js 24以上を使用します。

```sh
npm ci
npm run dev
```

```sh
npm run check          # 型検証・Lint・単体テスト・ビルド
npm run test:server    # 実SQLite Durable Objectの予算競合テスト
PRODUCTION_TEST=1 npm run test:e2e
```

Linuxでは先に `npx playwright install --with-deps chromium`。macOSはインストール済みChromeを使用します。

## 操作

| やりたいこと | 操作 |
|---|---|
| 記法を探す | 行頭で `/`。`/flow`、`/sequence`、`/heading`など |
| 薄い文字の候補を採用 | Tab。↑↓で候補選択、Escで閉じる |
| テンプレートの次／前の入力欄 | Tab / Shift+Tab |
| 改行する | Enter（候補の決定には使いません） |
| 図を編集 | 図をクリック。同じブロックにソースと図を表示 |
| 図の編集を終える | Esc |
| 補完を呼び出す | Ctrl+Space |
| AI・Markdown入出力 | ⌘ / Ctrl + Shift + P |
| ヘルプ | F1 |
| 元に戻す | ⌘ / Ctrl + Z |

Mermaid内では図種・方向・接続記号・同じ図のノードIDを補完します。補完は端末内のルール処理で、通信やAI推論を使いません。薄い候補は採用するまで保存・書き出し対象になりません。

## 保存と表示

Markdown原文をIndexedDBへ250ms後に保存します。空文書、不正な図、未対応記法も保持します。正常だった図のソースを保存し、構文エラーのまま再読み込みしても直前の図を再描画します（生SVGは保存しません）。

複数タブが同じ文書を変更すると、古いタブの上書きを止め、警告を表示します。そのタブの文章は残るため、Markdownを書き出してから再読み込み・統合してください。保存エラーでも編集と書き出しは続けられます。強制終了直前の250msは失われる可能性があります。

インポートは現在の文書を置き換え、Undoで取り消せます。改行はLFに統一します。重要な文書は書き出して保管してください。

## AI：モデル導入不要のクラウドと、任意の端末内実行

公開版のクラウドAIはCloudflare Workers AIで実行します。利用者のAPIキー・モデル導入・22GBの空き容量は不要です。AIを開いただけでは送信しません。送信ボタンの前に送信先と対象を表示します。

- 生成：入力した指示。
- 修復：選んだ図のコード・パーサーエラー・補足指示。
- 検証失敗時：不正な候補とエラーを加えて1回だけ再試行。
- 文書全体の送信、クラウドへの文書保存、自動AI補完は行いません。

生成・修復候補はMermaidで検証・試験描画し、図・コード（修復では差分）を表示します。「この候補を適用」の後にだけ反映します。処理中も本文を編集でき、対象が変わった古い修復は拒否します。取消後も開始済みのサーバー推論は計上されます。

PoCでは全体50リクエスト/UTC日・予約量40,000単位/日、同じIPは10回/日・2回/分のうち先に達する制限で停止します。予約量は入力UTF-8バイト数と最大出力量等の保守的な合算で、正確な課金トークン数ではありません。失敗と自動再試行も計上します。同じ会議ネットワークではIP制限を共有します。無料枠や利用上限は無制限提供の保証ではありません。

サーバーは指示を記録・保存せず、利用量制限のため日次ソルト付きIPハッシュとカウンターを保持します。Cloudflare側の処理は[データ利用方針](https://developers.cloudflare.com/workers-ai/platform/data-usage/)に従います。GitHub PagesやCloudflareのサービス側アクセス情報はアプリ独自のテレメトリーとは別です。

「この端末」を明示選択するとChrome Built-in AIを使います。対応環境と初回モデルダウンロードが必要です。[Chrome公式の条件](https://developer.chrome.com/docs/ai/prompt-api)を確認してください。22GBは初回導入時に必要とされる空き容量で、モデルのサイズを意味しません。端末内モデルの実動作は未検証です。

## AIサーバーの再公開

```sh
npx wrangler login
npm run server:deploy
VITE_AI_ENDPOINT=https://YOUR-WORKER.workers.dev/ai npm run build
```

`server/wrangler.jsonc`の`ALLOWED_ORIGIN`を自分の配信元に変更してください。Workers AIとSQLite Durable Objectを使います。秘密キーをブラウザへ埋め込みません。固定モデルをサーバーバインディングで呼び出します。`ENABLED=false`でAIを停止できます。CORSは認証ではないため、匿名公開による枠の使い切りは残る制約です。有料プランへ自動変更する処理はありません。

GitHub Actionsはリポジトリ変数`CANVAS_AI_ENDPOINT`を読み込みます。未設定なら基本編集と任意の端末内AIだけが動きます。`BASE_PATH=/<repo>/`でPages用のパスを設定します。ビルド時に指定したAIのoriginだけをCSPへ追加します。

実AIを呼ぶ試験は明示的な `LIVE_AI=1 TEST_URL=https://... npm run test:e2e -- tests/live-ai.spec.ts` のみ。通常のCIはモデル境界を差し替え、費用を発生させません。実モデルの検証結果は[検証記録](docs/VERIFICATION.md)を参照してください。

## 範囲と記録

正式検証対象はFlowchartとSequence Diagram。図は30,000文字・300エッジまで。外部画像・図内設定・生HTMLを無効化しています。大きな図は図内を横スクロールします。Chrome拡張、共同編集、認証、クラウド同期、複数文書管理、課金、独自学習は対象外です。

- [構成](ARCHITECTURE.md) / [進捗・残課題](CURRENT.md) / [検証記録](docs/VERIFICATION.md)
- [審査資料の条件](docs/SUBMISSION.md) / [A4原稿PDF](output/pdf/canvas-submission-draft.pdf)

公開リポジトリですが、再配布ライセンスは未選定です。Webアプリの基本編集は無料で利用できます。
