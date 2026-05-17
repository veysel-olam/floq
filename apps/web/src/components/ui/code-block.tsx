'use client'

import hljs from 'highlight.js/lib/core'
import langBash from 'highlight.js/lib/languages/bash'
import langC from 'highlight.js/lib/languages/c'
import langCpp from 'highlight.js/lib/languages/cpp'
import langCsharp from 'highlight.js/lib/languages/csharp'
import langCss from 'highlight.js/lib/languages/css'
import langGo from 'highlight.js/lib/languages/go'
import langIni from 'highlight.js/lib/languages/ini'
import langJava from 'highlight.js/lib/languages/java'
import langJs from 'highlight.js/lib/languages/javascript'
import langJson from 'highlight.js/lib/languages/json'
import langKotlin from 'highlight.js/lib/languages/kotlin'
import langMarkdown from 'highlight.js/lib/languages/markdown'
import langPhp from 'highlight.js/lib/languages/php'
import langPython from 'highlight.js/lib/languages/python'
import langRuby from 'highlight.js/lib/languages/ruby'
import langRust from 'highlight.js/lib/languages/rust'
import langSql from 'highlight.js/lib/languages/sql'
import langSwift from 'highlight.js/lib/languages/swift'
import langTs from 'highlight.js/lib/languages/typescript'
import langXml from 'highlight.js/lib/languages/xml'
import langYaml from 'highlight.js/lib/languages/yaml'

hljs.registerLanguage('bash', langBash); hljs.registerLanguage('sh', langBash); hljs.registerLanguage('shell', langBash)
hljs.registerLanguage('c', langC); hljs.registerLanguage('cpp', langCpp)
hljs.registerLanguage('csharp', langCsharp); hljs.registerLanguage('cs', langCsharp)
hljs.registerLanguage('css', langCss); hljs.registerLanguage('go', langGo)
hljs.registerLanguage('ini', langIni); hljs.registerLanguage('toml', langIni)
hljs.registerLanguage('java', langJava)
hljs.registerLanguage('javascript', langJs); hljs.registerLanguage('js', langJs); hljs.registerLanguage('jsx', langJs)
hljs.registerLanguage('json', langJson); hljs.registerLanguage('kotlin', langKotlin)
hljs.registerLanguage('markdown', langMarkdown); hljs.registerLanguage('md', langMarkdown)
hljs.registerLanguage('php', langPhp)
hljs.registerLanguage('python', langPython); hljs.registerLanguage('py', langPython)
hljs.registerLanguage('ruby', langRuby); hljs.registerLanguage('rb', langRuby)
hljs.registerLanguage('rust', langRust); hljs.registerLanguage('sql', langSql); hljs.registerLanguage('swift', langSwift)
hljs.registerLanguage('typescript', langTs); hljs.registerLanguage('ts', langTs); hljs.registerLanguage('tsx', langTs)
hljs.registerLanguage('html', langXml); hljs.registerLanguage('xml', langXml)
hljs.registerLanguage('yaml', langYaml); hljs.registerLanguage('yml', langYaml)

interface CodeBlockProps {
  code: string
  lang?: string
}

export function CodeBlock({ code, lang }: CodeBlockProps) {
  const language = lang?.toLowerCase() ?? ''
  const cleanCode = code.replace(/\n$/, '')

  const highlightedHtml = hljs.getLanguage(language)
    ? hljs.highlight(cleanCode, { language }).value
    : hljs.highlightAuto(cleanCode).value

  return (
    <div
      className="code-block relative my-2 rounded-lg overflow-hidden"
      onClick={(e) => e.stopPropagation()}
    >
      {language && (
        <span className="absolute top-2.5 right-3 text-[10px] font-sans uppercase tracking-widest select-none z-10 opacity-40 text-(--color-code-label)">
          {language}
        </span>
      )}
      <pre className="code-pre p-4 leading-relaxed whitespace-pre overflow-x-auto m-0 text-[0.76rem]">
        <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
      </pre>
    </div>
  )
}
