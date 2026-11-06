export interface Template {
  id: string
  title: string
  description: string
  aliases: string
  group: '文章' | '図'
  source: string
}
export const FLOW = 'flowchart LR\n  A[${1:はじめ}] --> B[${2:つぎ}]'
export const SEQUENCE = 'sequenceDiagram\n  participant User as ${1:利用者}\n  participant API as ${2:サーバー}\n  User->>API: ${3:リクエスト}\n  API-->>User: ${4:応答}'
const diagram = (source: string) => '```mermaid\n' + source + '\n```\n\n${0}'
export const templates: Template[] = [
  { id: 'flow', title: 'フロー図', description: '処理の流れを左から右へ', aliases: 'flowchart フローチャート 流れ 構成 図', group: '図', source: diagram(FLOW) },
  { id: 'sequence', title: 'シーケンス図', description: '登場人物のやり取りを時系列で', aliases: 'sequenceDiagram シーケンス 通信 順序 処理 図', group: '図', source: diagram(SEQUENCE) },
  { id: 'heading', title: '見出し', description: '大きな見出しで話題を区切る', aliases: 'h1 タイトル heading', group: '文章', source: '# ${1:見出し}\n\n${0}' },
  { id: 'h2', title: '小見出し', description: '見出しの下に節を作る', aliases: '見出し heading', group: '文章', source: '## ${1:小見出し}\n\n${0}' },
  { id: 'h3', title: '小さな見出し', description: '説明の中の項目を区切る', aliases: '見出し heading', group: '文章', source: '### ${1:項目}\n\n${0}' },
  { id: 'list', title: '箇条書き', description: '要点を並べる', aliases: 'bullet リスト 項目', group: '文章', source: '- ${1:項目}' },
  { id: 'number', title: '番号付きリスト', description: '手順を順番に並べる', aliases: '番号 手順 list', group: '文章', source: '1. ${1:項目}' },
  { id: 'bold', title: '太字', description: '大切な言葉を強調する', aliases: '強調 bold', group: '文章', source: '**${1:強調する言葉}**${0}' },
  { id: 'italic', title: '斜体', description: '言葉に軽い強調を付ける', aliases: '強調 emphasis italic', group: '文章', source: '*${1:強調する言葉}*${0}' },
  { id: 'inline', title: 'インラインコード', description: '短いコードや名前を文中に置く', aliases: 'inline code コード', group: '文章', source: '`${1:code}`${0}' },
  { id: 'code', title: 'コードブロック', description: '複数行のコードを書く', aliases: 'code ソース', group: '文章', source: '```${1:text}\n${2:コード}\n```\n\n${0}' },
  { id: 'decision', title: '条件分岐の図', description: '条件から「はい／いいえ」に分かれる', aliases: '分岐 判断 条件 if decision 図', group: '図', source: diagram('flowchart TD\n  A[${1:入力}] --> B{${2:条件}}\n  B -->|はい| C[${3:処理する}]\n  B -->|いいえ| D[${4:終了}]') },
  { id: 'database', title: 'データベース構成', description: '利用者 → Web → API → DB', aliases: 'データベース データ保存 db database システム 構成 図', group: '図', source: diagram('flowchart LR\n  U[${1:利用者}] --> W[Web]\n  W --> A[API]\n  A --> D[(${2:データベース})]') },
  { id: 'loop', title: '繰り返しの図', description: '処理を繰り返すシーケンス', aliases: 'ループ 繰り返し くりかえし loop 図', group: '図', source: diagram('sequenceDiagram\n  participant User as ${1:利用者}\n  participant API as ${2:API}\n  loop ${3:各項目について}\n    User->>API: ${4:処理を依頼}\n    API-->>User: 結果\n  end') },
  { id: 'parallel', title: '並列処理の図', description: '同時に進む2つの処理', aliases: '並列 同時 parallel par 図', group: '図', source: diagram('sequenceDiagram\n  participant App\n  participant A as ${1:サービスA}\n  participant B as ${2:サービスB}\n  par ${3:処理A}\n    App->>A: リクエスト\n  and ${4:処理B}\n    App->>B: リクエスト\n  end') },
  { id: 'group', title: 'グループ化した構成図', description: 'サービスの境界を枠で示す', aliases: 'グループ 境界 subgraph group 構成 図', group: '図', source: diagram('flowchart LR\n  User[${1:利用者}] --> A\n  subgraph Service[${2:サービス}]\n    A[API] --> D[(DB)]\n  end') },
]

export const normalizeSearch = (text: string) => text.normalize('NFKC').toLowerCase().replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60)).trim()
function oneTypo(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return false
  let i = 0, j = 0, edits = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue }
    if (++edits > 1) return false
    if (a.length >= b.length) i++
    if (b.length >= a.length) j++
  }
  return edits + (a.length - i) + (b.length - j) <= 1
}
export function searchScore(query: string, searchable: string): number {
  const words = normalizeSearch(searchable).split(/\s+/)
  const parts = normalizeSearch(query).replace(/^\//, '').split(/\s+/).filter(Boolean)
  let total = 0
  for (const part of parts) {
    const score = Math.max(0, ...words.map(word => word === part ? 100 : word.startsWith(part) ? 80 : word.includes(part) ? 50 : /^[a-z]{4,}$/.test(part) && oneTypo(part, word) ? 20 : 0))
    if (!score) return -1
    total += score
  }
  return total
}
export function searchTemplates(query: string): Template[] {
  return templates.map(item => ({ item, score: searchScore(query, `${item.id} ${item.title} ${item.aliases}`) }))
    .filter(item => item.score >= 0).sort((a, b) => b.score - a.score).map(({ item }) => item)
}
export function sampleText(source: string) {
  return source.replace(/\$\{\d+:([^}]*)\}/g, '$1').replace(/\$\{\d+\}/g, '')
}

export const diagramSnippets = {
  flow: [
    { label: 'node', title: 'ノードを追加', source: '${1:Node}[${2:名前}]' },
    { label: 'decision', title: '条件分岐のノード', source: '${1:Decision}{${2:条件}}' },
    { label: 'database', title: 'データベースのノード', source: '${1:DB}[(${2:データベース})]' },
    { label: 'subgraph', title: 'グループで囲む', source: 'subgraph ${1:Group}[${2:グループ}]\n  ${3:A} --> ${4:B}\nend' },
    { label: 'direction', title: 'グループ内の向き', source: 'direction ${1:LR}' },
  ],
  sequence: [
    { label: 'participant', title: '登場するサービス', source: 'participant ${1:API} as ${2:サービス}' },
    { label: 'actor', title: '登場する人', source: 'actor ${1:User} as ${2:利用者}' },
    { label: 'Note', title: '補足を付ける', source: 'Note right of ${1:API}: ${2:補足}' },
    { label: 'loop', title: '繰り返し', source: 'loop ${1:条件}\n  ${2:User}->>${3:API}: ${4:処理}\nend' },
    { label: 'alt', title: '条件による分岐', source: 'alt ${1:成功}\n  ${2:API}-->>${3:User}: ${4:結果}\nelse ${5:失敗}\n  ${2:API}-->>${3:User}: エラー\nend' },
    { label: 'opt', title: '条件付きの処理', source: 'opt ${1:条件}\n  ${2:User}->>${3:API}: ${4:処理}\nend' },
    { label: 'par', title: '並列処理', source: 'par ${1:処理A}\n  ${2:User}->>${3:API}: 依頼\nand ${4:処理B}\n  ${2:User}->>${3:API}: 別の依頼\nend' },
    { label: 'autonumber', title: 'メッセージに番号', source: 'autonumber' },
  ],
}
