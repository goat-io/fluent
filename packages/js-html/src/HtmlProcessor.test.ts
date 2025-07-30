import { describe, expect, it } from 'vitest'
import { HtmlProcessor } from './HtmlProcessor'

describe('HtmlProcessor', () => {
  it('should detect empty HTML', () => {
    expect(HtmlProcessor.isEmptyHTML('')).toBe(true)
    expect(HtmlProcessor.isEmptyHTML('   ')).toBe(true)
    expect(HtmlProcessor.isEmptyHTML('<div></div>')).toBe(true)
    expect(HtmlProcessor.isEmptyHTML('<div>  </div>')).toBe(true)
    expect(HtmlProcessor.isEmptyHTML('<br>')).toBe(true)
    expect(HtmlProcessor.isEmptyHTML('<span>content</span>')).toBe(false)
    expect(HtmlProcessor.isEmptyHTML('<div>hello</div>')).toBe(false)
  })

  it('should extract text from HTML', () => {
    const html = '<div>Hello <b>World</b><br>Test</div>'
    expect(HtmlProcessor.extractTextFromHTML(html)).toBe('Hello WorldTest')
    expect(
      HtmlProcessor.extractTextFromHTML('<div><script>bad()</script>ok</div>')
    ).toBe('ok')
    expect(HtmlProcessor.extractTextFromHTML('<style>body{}</style>abc')).toBe(
      'abc'
    )
  })

  it('should parse and sanitize HTML', () => {
    const html = '<div><b>Bold</b> <script>alert(1)</script></div>'
    const processor = new HtmlProcessor({ html })
    const parsed = processor.getParsedHtml()
    expect(parsed).toContain('Bold')
    expect(parsed).not.toContain('script')
    expect(parsed).toContain('<div')
  })

  it('should truncate HTML and append ellipsis if needed', () => {
    const html = '<div>Hello <b>World</b> and more text</div>'
    const processor = new HtmlProcessor({ html })
    const truncated = processor.getTruncatedHtml({
      truncate: 11,
      ellipsis: '...'
    })
    expect(truncated).toContain('...')
    expect(truncated.length).toBeGreaterThan(0)
  })

  it('should not append ellipsis if not truncated', () => {
    const html = '<div>Short</div>'
    const processor = new HtmlProcessor({ html })
    const truncated = processor.getTruncatedHtml({
      truncate: 100,
      ellipsis: '...'
    })
    expect(truncated).not.toContain('...')
  })

  it('should check if instance HTML is empty', () => {
    const processor = new HtmlProcessor({ html: '' })
    expect(processor.isHTMLEmpty()).toBe(true)
    const processor2 = new HtmlProcessor({ html: '<div>abc</div>' })
    expect(processor2.isHTMLEmpty()).toBe(false)
  })

  it('should register keywords', () => {
    const processor = new HtmlProcessor({ html: 'test' })
    processor.registerKeywords(['foo', 'bar'])
    // No direct way to check keywords, but getParsedHtml should not throw
    expect(() => processor.getParsedHtml()).not.toThrow()
  })

  it('should clean HTML and remove empty tags and <br>', () => {
    const processor = new HtmlProcessor({ html: '' })
    const dirty = '<div> <b> </b> <span>Text</span> <br> </div>'
    const cleaned = processor.cleanHTML(dirty)
    expect(cleaned).toContain('<div>')
    expect(cleaned).toContain('Text')
    expect(cleaned).not.toContain('<b>')
    expect(cleaned).not.toContain('<br>')
  })

  it('should format attributes correctly', () => {
    const processor = new HtmlProcessor({ html: '' })
    // @ts-expect-error testing private method
    expect(processor.formatAttributes({})).toBe('')
    // @ts-expect-error testing private method
    expect(processor.formatAttributes({ href: 'x', class: 'y' })).toBe(
      ' href="x" class="y"'
    )
  })
  it('should handle HTML with only attributes as not empty', () => {
    expect(HtmlProcessor.isEmptyHTML('<div id="x"></div>')).toBe(false)
  })

  it('should treat HTML with only whitespace as empty', () => {
    expect(HtmlProcessor.isEmptyHTML('   ')).toBe(true)
  })

  it('should ignore text inside <script> and <style>', () => {
    const html = '<div>abc<script>bad()</script><style>body{}</style>def</div>'
    expect(HtmlProcessor.extractTextFromHTML(html)).toBe('abcdef')
  })

  it('should sanitize HTML and remove disallowed tags', () => {
    const html = '<div><b>Bold</b><img src="x"><script>bad()</script></div>'
    const processor = new HtmlProcessor({ html })
    const parsed = processor.getParsedHtml()
    expect(parsed).toContain('Bold')
    expect(parsed).not.toContain('<img')
    expect(parsed).not.toContain('script')
  })

  it('should handle getTruncatedHtml with truncate=0', () => {
    const html = '<div>Some content</div>'
    const processor = new HtmlProcessor({ html })
    const truncated = processor.getTruncatedHtml({
      truncate: 0,
      ellipsis: '...'
    })
    expect(truncated).toContain('...')
  })

  it('should handle getTruncatedHtml with empty HTML', () => {
    const processor = new HtmlProcessor({ html: '' })
    const truncated = processor.getTruncatedHtml({
      truncate: 5,
      ellipsis: '...'
    })
    expect(truncated).toBe('')
  })

  it('should handle deeply nested empty tags in cleanHTML', () => {
    const processor = new HtmlProcessor({ html: '' })
    const dirty = '<div><span><b> </b></span></div>'
    const cleaned = processor.cleanHTML(dirty)

    expect(cleaned).not.toContain('<b>')
    expect(cleaned).not.toContain('<span>')
  })

  it('should not throw if registerKeyworks is called multiple times', () => {
    const processor = new HtmlProcessor({ html: 'foo' })
    processor.registerKeywords(['bar'])
    processor.registerKeywords(['baz'])
    expect(() => processor.getParsedHtml()).not.toThrow()
  })

  it('should clean HTML with nested empty tags', () => {
    const processor = new HtmlProcessor({ html: '' })
    const dirty = '<div><span> </span><b> </b><i>Text</i></div>'
    const cleaned = processor.cleanHTML(dirty)
    expect(cleaned).toContain('Text')
    expect(cleaned).not.toContain('<span>')
    expect(cleaned).not.toContain('<b>')
  })

  it('should clean HTML and preserve non-empty tags', () => {
    const processor = new HtmlProcessor({ html: '' })
    const dirty = '<div><b>Bold</b><span>Text</span></div>'
    const cleaned = processor.cleanHTML(dirty)
    expect(cleaned).toContain('Bold')
    expect(cleaned).toContain('Text')
  })

  it('should format attributes with multiple keys', () => {
    const processor = new HtmlProcessor({ html: '' })
    // @ts-expect-error testing private method
    const result = processor.formatAttributes({ a: '1', b: '2' })
    expect(result).toContain('a="1"')
    expect(result).toContain('b="2"')
  })

  it('should handle empty string in cleanHTML', () => {
    const processor = new HtmlProcessor({ html: '' })
    expect(processor.cleanHTML('')).toBe('')
  })

  it('should handle only <br> in cleanHTML', () => {
    const processor = new HtmlProcessor({ html: '' })
    expect(processor.cleanHTML('<br>')).toBe('')
  })

  it('should handle HTML with only comments as empty', () => {
    expect(HtmlProcessor.isEmptyHTML('<!-- comment -->')).toBe(true)
  })

  it('should handle HTML with entities in extractTextFromHTML', () => {
    const html = '<div>&amp; &lt; &gt; text</div>'
    expect(HtmlProcessor.extractTextFromHTML(html)).toContain('& < > text')
  })

  it('should handle getTruncatedHtml with no ellipsis', () => {
    const html = '<div>abcdefg</div>'
    const processor = new HtmlProcessor({ html })
    const truncated = processor.getTruncatedHtml({ truncate: 3, ellipsis: '' })
    expect(truncated).not.toContain('See more')
  })

  it('should handle getParsedHtml with keywords', () => {
    const processor = new HtmlProcessor({ html: 'foo bar' })
    processor.registerKeywords(['foo'])
    const parsed = processor.getParsedHtml()
    expect(parsed).toContain('foo')
  })

  it('should handle getParsedHtml with hashtags and mentions', () => {
    const processor = new HtmlProcessor({ html: '#tag @user' })
    const parsed = processor.getParsedHtml()
    expect(parsed).toContain('#tag')
    expect(parsed).toContain('@user')
  })

  it('should handle getParsedHtml with tickets', () => {
    const processor = new HtmlProcessor({ html: 'TICKET-123' })
    const parsed = processor.getParsedHtml()
    expect(parsed).toContain('TICKET-123')
  })
})
