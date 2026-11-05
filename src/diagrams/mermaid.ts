import DOMPurify from 'dompurify'

let engine: Promise<typeof import('mermaid')['default']> | undefined
let renderQueue: Promise<unknown> = Promise.resolve()

async function getEngine() {
  engine ??= import('mermaid').then(m => {
    m.default.initialize({
      startOnLoad: false, securityLevel: 'strict', suppressErrorRendering: true,
      theme: 'base', htmlLabels: false, fontFamily: 'system-ui, sans-serif',
      themeVariables: {
        fontSize: '20px', fontFamily: 'system-ui, sans-serif',
        primaryColor: '#edf4f1', primaryTextColor: '#243e36', primaryBorderColor: '#77978a',
        lineColor: '#759084', secondaryColor: '#f2f1ec', tertiaryColor: '#f7f9f6',
        actorBkg: '#edf4f1', actorBorder: '#77978a', actorTextColor: '#243e36',
        signalColor: '#536e62', signalTextColor: '#243e36',
      },
      flowchart: { htmlLabels: false, useMaxWidth: false, padding: 20, nodeSpacing: 40, rankSpacing: 65 },
      sequence: { useMaxWidth: false, actorFontSize: 20, messageFontSize: 20, noteFontSize: 20 },
      maxTextSize: 30_000, maxEdges: 300,
    })
    return m.default
  })
  return engine
}

export function checkSource(source: string) {
  if (!source.trim()) throw new Error('図のコードを入力してください。')
  if (source.length > 30_000) throw new Error('図が大きすぎます。複数の図に分けてください。')
  if (/^\s*---|%%\s*\{|\bimg\s*:/m.test(source)) throw new Error('このPoCでは図内の設定変更・外部画像は利用できません。')
}

export function renderMermaid(source: string, id: string): Promise<string> {
  // Mermaid uses DOM measurement and shared configuration: serialize all callers, including AI.
  const work = renderQueue.catch(() => {}).then(async () => {
    checkSource(source)
    const mermaid = await getEngine()
    await mermaid.parse(source)
    const { svg } = await mermaid.render(id, source)
    return DOMPurify.sanitize(svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      FORBID_TAGS: ['foreignObject', 'image', 'a', 'script'],
      FORBID_ATTR: ['href', 'xlink:href'],
    })
  })
  renderQueue = work
  return work
}
