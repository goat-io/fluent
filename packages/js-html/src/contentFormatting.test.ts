// Run: pnpm --filter @goatlab/js-html test src/contentFormatting.test.ts
import { DomUtils, parseDocument } from 'htmlparser2'
import { describe, expect, it } from 'vitest'
import { HtmlProcessor } from './HtmlProcessor.js'

const parsed = (html: string) => new HtmlProcessor({ html }).getParsedHtml()

describe('post content formatting', () => {
  it('retains separate items and native list markers instead of concatenating text', () => {
    expect(parsed('<ul><li>First</li><li>Second</li></ul>')).toBe(
      '<ul><li>First</li><li>Second</li></ul>',
    )
  })
  it.each(['\n', '\r\n', '\r'])(
    'preserves paragraphs and literal list lines with %j',
    newline => {
      expect(
        parsed(
          ['First', '', 'Second', '- One', '• Two', '1. Three'].join(newline),
        ),
      ).toBe('First<br /><br />Second<br />- One<br />• Two<br />1. Three')
    },
  )
  it('retains real HTML breaks, including an intentionally empty paragraph', () => {
    expect(parsed('<p>First<br>Second</p><p><br></p><p>Third</p>')).toBe(
      '<p>First<br />Second</p><p><br /></p><p>Third</p>',
    )
  })
  it('safely escapes text and preserves existing entity semantics', () => {
    expect(
      HtmlProcessor.normalizeContentHtml('2 < 3 & 4 > 1\nTom &amp; Jane'),
    ).toBe('2 &lt; 3 &amp; 4 &gt; 1<br>Tom &amp; Jane')
    expect(parsed('&lt;script&gt;alert(1)&lt;/script&gt;\nEnd')).not.toContain(
      '<script>',
    )
  })
  it('preserves ordinary nested lists and ordered numbering attributes', () => {
    const html =
      '<ol start="3"><li>Third<ul><li>Nested</li></ul></li><li value="7">Seventh</li></ol>'
    expect(parsed(html)).toBe(html)
  })
  it('converts Quill mixed list kinds into semantic sibling lists', () => {
    expect(
      parsed(
        '<ol><li data-list="bullet"><span class="ql-ui" contenteditable="false"></span>One</li><li data-list="bullet">Two</li><li data-list="ordered">Three</li><li data-list="bullet">Four</li></ol>',
      ),
    ).toBe(
      '<ul><li>One</li><li>Two</li></ul><ol><li>Three</li></ol><ul><li>Four</li></ul>',
    )
  })
  it('turns Quill indentation into nested lists inside their actual parent item', () => {
    expect(
      parsed(
        '<ol><li data-list="bullet">Parent</li><li data-list="ordered" class="ql-indent-1">Child one</li><li data-list="ordered" class="ql-indent-1">Child two</li><li data-list="bullet" class="ql-indent-2">Grandchild</li><li data-list="bullet">Sibling</li></ol>',
      ),
    ).toBe(
      '<ul><li>Parent<ol><li>Child one</li><li>Child two<ul><li>Grandchild</li></ul></li></ol></li><li>Sibling</li></ul>',
    )
  })
  it('continues Quill numbering across same-depth bullet runs', () => {
    expect(
      parsed(
        '<ol><li data-list="ordered">One</li><li data-list="bullet">Aside</li><li data-list="ordered">Two</li></ol>',
      ),
    ).toBe(
      '<ol><li>One</li></ol><ul><li>Aside</li></ul><ol start="2"><li>Two</li></ol>',
    )
  })
  it('continues nested numbering across bullets but resets it after a shallower item', () => {
    expect(
      parsed(
        '<ol><li data-list="bullet">Parent</li><li data-list="ordered" class="ql-indent-1">One</li><li data-list="bullet" class="ql-indent-1">Aside</li><li data-list="ordered" class="ql-indent-1">Two</li><li data-list="bullet">Next parent</li><li data-list="ordered" class="ql-indent-1">One again</li></ol>',
      ),
    ).toBe(
      '<ul><li>Parent<ol><li>One</li></ol><ul><li>Aside</li></ul><ol start="2"><li>Two</li></ol></li><li>Next parent<ol><li>One again</li></ol></li></ul>',
    )
  })
  it.each(['0', '-3', '+3'])(
    'retains safe signed start %s through mixed list segments',
    start => {
      const nextStart =
        Number(start) + 1 === 1 ? '' : ` start="${Number(start) + 1}"`
      expect(
        parsed(
          `<ol start="${start}"><li data-list="ordered">First</li><li data-list="bullet">Aside</li><li data-list="ordered">Second</li></ol>`,
        ),
      ).toBe(
        `<ol start="${Number(start)}"><li>First</li></ol><ul><li>Aside</li></ul><ol${nextStart}><li>Second</li></ol>`,
      )
    },
  )
  it('honors explicit item values when continuing a new ordered segment', () => {
    expect(
      parsed(
        '<ol start="3"><li data-list="ordered" value="0">Zero</li><li data-list="bullet">Aside</li><li data-list="ordered">One</li><li data-list="ordered" value="-2">Negative two</li><li data-list="bullet">Aside</li><li data-list="ordered">Negative one</li></ol>',
      ),
    ).toBe(
      '<ol start="0"><li value="0">Zero</li></ol><ul><li>Aside</li></ul><ol><li>One</li><li value="-2">Negative two</li></ol><ul><li>Aside</li></ul><ol start="-1"><li>Negative one</li></ol>',
    )
  })
  it.each(['1.5', 'nope', '9007199254740992', '-9007199254740992'])(
    'discards invalid or unsafe numbering attribute %s',
    value => {
      expect(
        parsed(`<ol start="${value}"><li value="${value}">One</li></ol>`),
      ).toBe('<ol><li>One</li></ol>')
    },
  )
  it('changes nested kinds without closing the parent item or nesting sibling lists in each other', () => {
    expect(
      parsed(
        '<ol><li data-list="ordered">Parent</li><li data-list="bullet" class="ql-indent-1">Bullet</li><li data-list="ordered" class="ql-indent-1">Number</li><li data-list="ordered">Next</li></ol>',
      ),
    ).toBe(
      '<ol><li>Parent<ul><li>Bullet</li></ul><ol><li>Number</li></ol></li><li>Next</li></ol>',
    )
  })
  it('collapses impossible indentation gaps without creating blank parent items', () => {
    expect(
      parsed(
        '<ol><li data-list="bullet" class="ql-indent-3">One</li><li data-list="bullet" class="ql-indent-3">Two</li><li data-list="bullet" class="ql-indent-8">Child</li><li data-list="bullet">Root</li></ol>',
      ),
    ).toBe(
      '<ul><li>One</li><li>Two<ul><li>Child</li></ul></li></ul><ul><li>Root</li></ul>',
    )
  })
  it.each([
    'First\n\nSecond',
    '<p>First</p>\n<p>Second</p>',
    '<ul><li>A<ol start="2"><li>B</li></ol></li></ul>',
    '<ol><li data-list="bullet">A</li><li data-list="ordered" class="ql-indent-1">B</li></ol>',
    '<ol start="0"><li data-list="ordered">A</li><li data-list="bullet">B</li><li data-list="ordered">C</li></ol>',
    '&lt;b&gt;literal&lt;/b&gt;',
  ])('normalizes idempotently: %s', html => {
    const normalized = HtmlProcessor.normalizeContentHtml(html)
    expect(HtmlProcessor.normalizeContentHtml(normalized)).toBe(normalized)
  })
  it('retains sanitization after list conversion', () => {
    const html =
      '<ol onclick="bad()"><li data-list="bullet" onmouseover="bad()">Safe<script>bad()</script><a href="javascript:bad()">link</a></li></ol>'
    const result = parsed(html)
    expect(result).toBe('<ul><li>Safe<a>link</a></li></ul>')
  })
  it('does not turn source-formatting whitespace between HTML blocks into new breaks', () => {
    expect(parsed('<p>A</p>\n<p>B</p>')).not.toContain('<br>')
  })
  it.each(['\n', '\r\n', '\r'])(
    'preserves %j within paragraph text and mixed inline content',
    newline => {
      expect(parsed(`<p>First${newline}Second</p>`)).toBe(
        '<p>First<br />Second</p>',
      )
      expect(parsed(`First <b>bold</b>${newline}Second`)).toBe(
        'First <b>bold</b><br />Second',
      )
    },
  )
  it('preserves consecutive whitespace-only breaks between inline siblings', () => {
    expect(parsed('<b>First</b>\n\n<i>Second</i>')).toBe(
      '<b>First</b><br /><br /><i>Second</i>',
    )
  })
  it('does not add breaks around pretty-printed blocks or list items', () => {
    const html =
      '\n<div>\n  <p>First</p>\n  <p>Second</p>\n  <ul>\n    <li>One</li>\n    <li>Two</li>\n  </ul>\n</div>\n'
    expect(parsed(html)).not.toContain('<br')
    expect(parsed('<ul>\n<li>First\nSecond</li>\n</ul>')).toBe(
      '<ul>\n<li>First<br />Second</li>\n</ul>',
    )
  })
  it('escapes decoded inline text without promoting entities into HTML', () => {
    const result = parsed(
      '<p>&lt;script&gt;literal&lt;/script&gt;\nTom &amp; Jane</p>',
    )
    expect(result).toContain('&lt;script&gt;literal&lt;/script&gt;<br />')
    expect(result).not.toContain('<script>')
    expect(DomUtils.textContent(parseDocument(result))).toBe(
      '<script>literal</script>Tom & Jane',
    )
  })
  it('leaves script and style contents untouched by structural normalization', () => {
    const html =
      '<script>first\r\nsecond</script><style>first\r\nsecond</style>'
    expect(HtmlProcessor.normalizeContentHtml(html)).toBe(html)
    expect(parsed(html)).toBe('')
  })
  it.each([
    '<p>First\r\n\r\nSecond</p>',
    'First <b>bold</b>\nSecond',
    '<b>First</b>\n\n<i>Second</i>',
    '\n<div>\n<p>First</p>\n<p>Second</p>\n</div>\n',
    '<p>&lt;b&gt;literal&lt;/b&gt;\nText</p>',
  ])('normalizes mixed HTML line breaks idempotently: %s', html => {
    const normalized = HtmlProcessor.normalizeContentHtml(html)
    expect(HtmlProcessor.normalizeContentHtml(normalized)).toBe(normalized)
  })
  it('keeps truncation balanced and preserves list structure when expanded', () => {
    const html = '<ul><li>Alpha beta</li><li>Gamma delta</li></ul>'
    const processor = new HtmlProcessor({ html })
    const short = processor.getTruncatedHtml({ truncate: 5, ellipsis: 'More' })
    expect(short).toContain('<ul><li>')
    expect(short).toContain('</li></ul>')
    expect(short).toContain('href="/expand"')
    expect(DomUtils.textContent(parseDocument(short))).toContain('Alpha')
    expect(processor.getTruncatedHtml({})).toBe(html)
  })
})
