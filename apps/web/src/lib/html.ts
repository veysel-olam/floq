// Remote (ActivityPub) content arrives as HTML (Mastodon etc.): <p>, <br>, <a>…
// We render content as plain text + our own linkifier, so convert the HTML to
// readable text first. This also avoids XSS — no remote markup reaches the DOM.
export function htmlToText(html: string): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<p>/gi, '')
    .replace(/<[^>]+>/g, '') // strip remaining tags (a, span, etc.)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => { try { return String.fromCodePoint(parseInt(h, 16)) } catch { return '' } })
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)) } catch { return '' } })
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lsquo;/gi, '‘').replace(/&rsquo;/gi, '’')
    .replace(/&ldquo;/gi, '“').replace(/&rdquo;/gi, '”')
    .replace(/&hellip;/gi, '…').replace(/&mdash;/gi, '—').replace(/&ndash;/gi, '–')
    .replace(/&laquo;/gi, '«').replace(/&raquo;/gi, '»')
    .replace(/&trade;/gi, '™').replace(/&copy;/gi, '©').replace(/&reg;/gi, '®')
    .replace(/&deg;/gi, '°').replace(/&bull;/gi, '•').replace(/&middot;/gi, '·')
    .replace(/&euro;/gi, '€').replace(/&pound;/gi, '£').replace(/&cent;/gi, '¢')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

// True when a string contains HTML markup (cheap heuristic for remote content).
export function looksLikeHtml(s: string | null | undefined): boolean {
  return !!s && /<\/?[a-z][\s\S]*>/i.test(s)
}
