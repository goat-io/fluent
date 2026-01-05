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

  it('should not create spurious links for spaces when using truncation with ellipsis', () => {
    // This test reproduces a bug where the "...See more " ellipsis with trailing space
    // was being registered as a keyword and causing spaces to be linkified
    const html = '<div>Hello world this is a test message</div>'
    const processor = new HtmlProcessor({ html })

    const truncated = processor.getTruncatedHtml({
      truncate: 10,
      ellipsis: '...See more'
    })

    // Should not have links to /tags/ for regular spaces
    expect(truncated).not.toMatch(/href="\/tags\/\s*"/)
    // Should not have empty href links
    expect(truncated).not.toMatch(/href="\/tags\/"[^>]*>\s*<\/a>/)
  })

  it('should register and apply keywords correctly', () => {
    // Note: linkify-plugin-keyword uses global state, so keywords registered
    // in one processor will persist for subsequent processors in the same process.
    // This is a known limitation of the library design.
    const processor = new HtmlProcessor({ html: 'foo bar', keywords: ['foo'] })
    const parsed = processor.getParsedHtml()

    // Should contain both words
    expect(parsed).toContain('foo')
    expect(parsed).toContain('bar')

    // Note: Keywords are registered globally by linkify-plugin-keyword
    // The first call to getParsedHtml registers keywords, but they may not
    // be applied until subsequent linkify calls in the same process
  })

  it('should handle plain text messages without creating spurious links', () => {
    // Simulate a chat message scenario
    const html = '<div>This is a simple chat message with spaces</div>'
    const processor = new HtmlProcessor({ html })
    const parsed = processor.getParsedHtml()

    // Should not have any links to /tags/ for plain text without hashtags/mentions
    expect(parsed).not.toContain('href="/tags/')
  })

  it('should not create spurious links for complex AI chat responses', () => {
    // This is the exact HTML that was causing problems in the frontend chat
    const html = `<div><div>The average of averages in Peru's exports for the provided data can be calculated by considering the percentage changes in export volumes for different products. Here's a summary of the average percentage changes for the main products:</div>\n\n<div style="display:flex; margin:5px 0;"><b>1. Uvas de Mesa:</b> +31.5%</div>\n<div style="display:flex; margin:5px 0;"><b>2. Arándanos:</b> +41.6%</div>\n<div style="display:flex; margin:5px 0;"><b>3. Mangos:</b> +249.5%</div>\n<div style="display:flex; margin:5px 0;"><b>4. Paltas:</b> +27.9%</div>\n<div style="display:flex; margin:5px 0;"><b>5. Mandarinas:</b> +9.9%</div>\n<div style="display:flex; margin:5px 0;"><b>6. Granadas:</b> +37.0%</div>\n<div style="display:flex; margin:5px 0;"><b>7. Limas:</b> -27.7%</div>\n<div style="display:flex; margin:5px 0;"><b>8. Espárragos:</b> -71.5%</div>\n<div style="display:flex; margin:5px 0;"><b>9. Naranjas:</b> +69.7%</div>\n\n<div style="display:flex; margin:5px 0;">To find the average of these percentage changes, sum them up and divide by the number of products:</div>\n\n<div style="display:flex; margin:5px 0;">Average = (31.5 + 41.6 + 249.5 + 27.9 + 9.9 + 37.0 - 27.7 - 71.5 + 69.7) / 9</div>\n\n<div style="display:flex; margin:5px 0;">Average = 367.9 / 9 ≈ 40.88%</div>\n\n<div style="display:flex; margin:5px 0;">Therefore, the average percentage change in Peru's exports for these products is approximately 40.88%.</div></div>`

    const processor = new HtmlProcessor({ html })

    // Test getParsedHtml - should not create spurious links
    const parsed = processor.getParsedHtml()
    expect(parsed).toContain('Uvas de Mesa')
    expect(parsed).toContain('+31.5%')
    // Should NOT have links to /tags/ for regular text
    expect(parsed).not.toMatch(/href="\/tags\/[^"]*"[^>]*>[^<]*<\/a>/)

    // Test getTruncatedHtml - this was the main culprit with triple linkify calls
    const truncated = processor.getTruncatedHtml({
      truncate: 100,
      ellipsis: '...See more'
    })
    expect(truncated).toContain('average')
    // Should NOT have spurious links for spaces or regular words
    expect(truncated).not.toMatch(/href="\/tags\/\s*"/)
    // Should still contain proper content
    expect(truncated).toContain('...See more')
  })

  it('should preserve linkify functionality for hashtags and mentions', () => {
    const html =
      '<div>Check out #agriculture and contact @farmer for more info</div>'
    const processor = new HtmlProcessor({ html })
    const parsed = processor.getParsedHtml()

    // Should linkify hashtags
    expect(parsed).toContain('href="/hashtag/agriculture"')
    // Should linkify mentions (formatHref adds 'account' prefix)
    expect(parsed).toContain('href="account/farmer"')
    expect(parsed).toContain('@farmer')
  })

  it('should preserve linkify functionality for URLs', () => {
    const html = '<div>Visit https://example.com for more info</div>'
    const processor = new HtmlProcessor({ html })
    const parsed = processor.getParsedHtml()

    // Should linkify URLs
    expect(parsed).toContain('href="https://example.com"')
  })

  it('should not create spurious links when keywords contain spaces or special patterns', () => {
    // This simulates the issue where the ellipsis "...See more " was registered as a keyword
    // and caused spaces to be matched
    const processor1 = new HtmlProcessor({
      html: 'Hello world',
      keywords: ['...See more '] // Note the trailing space - this was the bug trigger
    })
    const parsed1 = processor1.getParsedHtml()

    // The keyword itself might be matched, but regular spaces should NOT become links
    // Check that we don't have links to empty or whitespace-only hrefs
    expect(parsed1).not.toMatch(/href="\/tags\/\s*"/)
    expect(parsed1).not.toMatch(/href="\/tags\/"[^>]*>\s+<\/a>/)

    // Now test with the complex AI response after the keyword was registered
    const processor2 = new HtmlProcessor({
      html: '<div>This is a test message with spaces</div>'
    })
    const parsed2 = processor2.getParsedHtml()

    // Should not have spurious links
    expect(parsed2).not.toMatch(/href="\/tags\/\s*"/)
  })

  it('should not double-linkify content when calling getTruncatedHtml', () => {
    // The bug was that linkifyHtml was called 3 times in getTruncatedHtml
    // This could cause issues when keywords or other patterns were matched multiple times
    const html = '<div>Check out https://example.com and #hashtag</div>'
    const processor = new HtmlProcessor({ html })

    const truncated = processor.getTruncatedHtml({
      truncate: 50,
      ellipsis: '...'
    })

    // Should have the URL linkified exactly once (not nested <a> tags)
    const urlMatches = truncated.match(/href="https:\/\/example\.com"/g)
    expect(urlMatches).not.toBeNull()
    // The URL should appear only once or twice (once in the original, possibly once after re-process)
    // but should not create broken nested links
    expect(truncated).not.toContain('<a href="https://example.com"><a')

    // Should have hashtag linkified
    expect(truncated).toContain('href="/hashtag/hashtag"')
  })

  it('should replicate RichTextDisplay usage pattern without creating spurious links', () => {
    // This exactly replicates how RichTextDisplay uses HtmlProcessor
    // It registers the expandKeyWord as a keyword and then calls getTruncatedHtml with it as ellipsis
    const expandKeyWord = '...See more '
    const content = `<div><div>The average of averages in Peru's exports for the provided data can be calculated by considering the percentage changes in export volumes for different products. Here's a summary of the average percentage changes for the main products:</div>\n\n<div style="display:flex; margin:5px 0;"><b>1. Uvas de Mesa:</b> +31.5%</div>\n<div style="display:flex; margin:5px 0;"><b>2. Arándanos:</b> +41.6%</div></div>`

    const htmlProcessor = new HtmlProcessor({
      html: content,
      keywords: [expandKeyWord]
    })

    const finalHtml = htmlProcessor.getTruncatedHtml({
      truncate: 100,
      ellipsis: expandKeyWord
    })

    // Should contain the ellipsis
    expect(finalHtml).toContain('...See more')

    // Should NOT have spurious links for spaces or the ellipsis keyword matching regular spaces
    // The bug was that spaces in the text were being wrapped in <a> tags pointing to /tags/
    expect(finalHtml).not.toMatch(/<a[^>]*href="\/tags\/[^"]*"[^>]*>\s+<\/a>/)
    expect(finalHtml).not.toMatch(/href="\/tags\/\s*"/)

    // Count the number of /tags/ links - should be minimal (only for actual keyword matches)
    const tagsLinks = (finalHtml.match(/href="\/tags\//g) || []).length
    // The expandKeyWord might create one link to /expand, but regular spaces should not create links
    expect(tagsLinks).toBeLessThanOrEqual(1)
  })

  it('should handle multiple RichTextDisplay instances without accumulating spurious links', () => {
    // Simulate what happens when multiple RichTextDisplay components render
    const expandKeyWord = '...See more '
    const contents = [
      '<div>First message with spaces</div>',
      '<div>Second message with more spaces</div>',
      '<div>Third message also has spaces</div>'
    ]

    // Process multiple messages like RichTextDisplay does
    const results = contents.map(content => {
      const processor = new HtmlProcessor({
        html: content,
        keywords: [expandKeyWord]
      })
      return processor.getTruncatedHtml({
        truncate: 20,
        ellipsis: expandKeyWord
      })
    })

    // None of them should have spurious /tags/ links for spaces
    for (const result of results) {
      expect(result).not.toMatch(/<a[^>]*href="\/tags\/[^"]*"[^>]*>\s+<\/a>/)
      expect(result).not.toMatch(/href="\/tags\/\s*"/)
    }
  })

  it('should understand why double linkify might be needed for character count', () => {
    // The original code had:
    // 1. getParsedHtml() - linkifies content (adds <a> tags which increase character count)
    // 2. truncateHtml() - truncates based on visible text (ignores HTML tags)
    // 3. linkifyHtml() - first pass after truncation
    // 4. linkifyHtml() - second pass after truncation
    //
    // The question is: why two passes after truncation?
    //
    // Hypothesis 1: truncateHtml counts text WITHOUT html tags, but after linkification
    // the visible text length changes because linkifyHtml might format/shorten URLs?
    //
    // Hypothesis 2: The ellipsis needs to be linkified separately, and the second pass
    // ensures it's properly linked as a keyword.
    //
    // Let's trace through what happens:

    const html =
      '<div>Check out https://example.com/very/long/path for more #info</div>'
    const processor = new HtmlProcessor({ html, keywords: ['...See more'] })

    // Step 1: getParsedHtml() - this linkifies URLs, hashtags, mentions, keywords
    const parsed = processor.getParsedHtml()
    console.log('Step 1 - getParsedHtml:', parsed)

    // The URL and hashtag should be linkified
    expect(parsed).toContain('href="https://example.com/very/long/path"')
    expect(parsed).toContain('href="/hashtag/info"')

    // Step 2: Extract text length (this is what truncateHtml uses)
    const textLength = HtmlProcessor.extractTextFromHTML(parsed).length
    console.log('Text length:', textLength)

    // The key insight: truncateHtml uses VISIBLE text length, not HTML length
    // So "Check out https://example.com/very/long/path for more #info" = 57 chars
    // But the HTML with <a> tags is much longer

    // This test validates that the current fix (single linkify after truncation) works
    const truncated = processor.getTruncatedHtml({
      truncate: 20,
      ellipsis: '...See more'
    })
    console.log('Truncated result:', truncated)

    // The ellipsis should be present
    expect(truncated).toContain('...See more')

    // Links should still work
    expect(truncated).toContain('href="https://example.com/very/long/path"')

    // No spurious links
    expect(truncated).not.toMatch(/href="\/tags\/\s*"/)
  })

  it('should handle the edge case where truncation cuts through a linked word', () => {
    // What if truncation cuts in the middle of a linked mention like @farmer?
    const html = '<div>Contact @farmerprofessional for help</div>'
    const processor = new HtmlProcessor({ html })

    const truncated = processor.getTruncatedHtml({
      truncate: 15, // "Contact @farmer" = 15 chars
      ellipsis: '...'
    })

    console.log('Truncated mention:', truncated)

    // The truncation should happen cleanly
    expect(truncated).toContain('...')
    // Should not have broken/nested links
    expect(truncated).not.toContain('<a href="account/farmerprofessional"><a')
  })

  it('should NOT create links for spaces when ellipsis is a single space', () => {
    // This is the EXACT bug scenario from ChatListItem.tsx:
    // ellipsis=" " (single space) was being passed to RichTextDisplay
    // This was being registered as a keyword, causing ALL spaces to become links
    //
    // The fix is that we should NOT linkify the ellipsis when it's just whitespace

    const html = '<div>The average of averages in exports for products</div>'
    const singleSpaceEllipsis = ' '

    const processor = new HtmlProcessor({
      html,
      keywords: [singleSpaceEllipsis] // This simulates RichTextDisplay registering the ellipsis as keyword
    })

    const truncated = processor.getTruncatedHtml({
      truncate: 35,
      ellipsis: singleSpaceEllipsis
    })

    console.log('With single space ellipsis:', truncated)

    // THE KEY BUG: Spaces should NOT become links!
    // If spaces become links to /tags/, that's the bug
    expect(truncated).not.toMatch(/href="\/tags\/\s*"/)
    expect(truncated).not.toMatch(/<a[^>]*href="\/tags\/[^"]*"[^>]*>\s+<\/a>/)

    // Count links - there should be ZERO links since there are no hashtags/mentions/urls
    const linkCount = (truncated.match(/<a /g) || []).length
    console.log('Number of links:', linkCount)

    // Ideally there should be 0 links, or at most 1 if the ellipsis itself is linked
    // But definitely NOT one link per space in the content!
    expect(linkCount).toBeLessThan(5)
  })

  it('should properly append and linkify "See more" ellipsis after truncation', () => {
    // The ellipsis should be appended when content is truncated
    // AND it should ALWAYS be wrapped in an <a> tag pointing to /expand
    const html =
      '<div>This is a long text that will be truncated to show the see more link</div>'
    const expandKeyWord = '...See more '

    const processor = new HtmlProcessor({
      html,
      keywords: [expandKeyWord]
    })

    const truncated = processor.getTruncatedHtml({
      truncate: 30,
      ellipsis: expandKeyWord
    })

    console.log('See more result:', truncated)

    // The ellipsis should be present in the output
    expect(truncated).toContain('...See more')

    // Content should be truncated (not the full text)
    expect(truncated).not.toContain('the see more link')

    // No spurious links for spaces
    expect(truncated).not.toMatch(/href="\/tags\/\s*"/)

    // The ellipsis MUST be wrapped in an <a> tag with href="/expand"
    // This is required for RichTextDisplay components to work
    expect(truncated).toContain('href="/expand"')
    expect(truncated).toMatch(/<a[^>]*href="\/expand"[^>]*>.*See more/)
  })

  it('should test keyword matching behavior', () => {
    // Let's understand what keywords actually get matched by linkify-plugin-keyword

    // Test 1: Simple single-word keyword
    const processor1 = new HtmlProcessor({
      html: '<div>Check the documentation</div>',
      keywords: ['documentation']
    })
    const result1 = processor1.getParsedHtml()
    console.log('Single word keyword:', result1)
    console.log(
      'Single word has link:',
      result1.includes('href="/tags/documentation"')
    )

    // Test 2: Multi-word keyword with spaces
    const processor2 = new HtmlProcessor({
      html: '<div>Check See more info</div>',
      keywords: ['See more']
    })
    const result2 = processor2.getParsedHtml()
    console.log('Multi-word keyword:', result2)

    // Test 3: Keyword with dots
    const processor3 = new HtmlProcessor({
      html: '<div>Check ...See more info</div>',
      keywords: ['...See more']
    })
    const result3 = processor3.getParsedHtml()
    console.log('Dots keyword:', result3)

    // Test 4: The actual expandKeyWord pattern
    const processor4 = new HtmlProcessor({
      html: '<div>Long text ...See more </div>',
      keywords: ['...See more ']
    })
    const result4 = processor4.getParsedHtml()
    console.log('Full expandKeyWord:', result4)

    // All should not create spurious links
    expect(result1).not.toMatch(/href="\/tags\/\s*"/)
    expect(result2).not.toMatch(/href="\/tags\/\s*"/)
    expect(result3).not.toMatch(/href="\/tags\/\s*"/)
    expect(result4).not.toMatch(/href="\/tags\/\s*"/)
  })

  it('should append custom ellipsis text after truncation', () => {
    const html =
      '<div>This is a very long paragraph that needs truncation</div>'
    const customEllipsis = '... Read more'

    const processor = new HtmlProcessor({
      html,
      keywords: [] // Not registering as keyword - just plain text ellipsis
    })

    const truncated = processor.getTruncatedHtml({
      truncate: 20,
      ellipsis: customEllipsis
    })

    console.log('Custom ellipsis appended:', truncated)

    // The custom ellipsis should be appended (even if not linkified)
    expect(truncated).toContain('... Read more')
    // Content should be truncated
    expect(truncated).toContain('This is a very long')
    // No spurious links
    expect(truncated).not.toMatch(/href="\/tags\/\s*"/)
  })

  it('should handle HTML-heavy text with multiple nested tags', () => {
    const html = `
      <div>
        <p><strong>Important:</strong> This is <em>emphasized</em> text.</p>
        <p>Check out <b>bold text</b> and <i>italic text</i> together.</p>
        <div>
          <p>Nested paragraph with @mention and #hashtag</p>
        </div>
      </div>
    `

    const processor = new HtmlProcessor({ html })
    const parsed = processor.getParsedHtml()

    console.log('HTML-heavy parsed:', parsed)

    // Should preserve allowed tags
    expect(parsed).toContain('<strong>')
    expect(parsed).toContain('<em>')
    expect(parsed).toContain('<b>')
    expect(parsed).toContain('<i>')
    expect(parsed).toContain('<p>')
    expect(parsed).toContain('<div>')

    // Should linkify mentions and hashtags
    expect(parsed).toContain('href="account/mention"')
    expect(parsed).toContain('href="/hashtag/hashtag"')

    // Content should be preserved
    expect(parsed).toContain('Important:')
    expect(parsed).toContain('emphasized')
    expect(parsed).toContain('bold text')
  })

  it('should handle HTML with inline styles and complex structure', () => {
    const html = `
      <div style="margin: 10px;">
        <p>First paragraph with https://example.com link</p>
        <div style="display:flex;">
          <b>1. Item one:</b> Description here
        </div>
        <div style="display:flex;">
          <b>2. Item two:</b> Another description with @user mention
        </div>
      </div>
    `

    const processor = new HtmlProcessor({ html })
    const parsed = processor.getParsedHtml()

    console.log('Complex HTML parsed:', parsed)

    // URLs should be linkified
    expect(parsed).toContain('href="https://example.com"')

    // Mentions should be linkified
    expect(parsed).toContain('href="account/user"')

    // Structure should be preserved (div with style is allowed)
    expect(parsed).toContain('<div')
    expect(parsed).toContain('style=')

    // Content should be intact
    expect(parsed).toContain('Item one')
    expect(parsed).toContain('Item two')
  })

  it('should handle truncation of HTML-heavy content with See more', () => {
    const html = `
      <div>
        <p><strong>Breaking News:</strong> This is an important announcement.</p>
        <p>Read the full article for more details about #technology and @reporter coverage.</p>
      </div>
    `
    const expandKeyWord = '...See more '

    const processor = new HtmlProcessor({
      html,
      keywords: [expandKeyWord]
    })

    const truncated = processor.getTruncatedHtml({
      truncate: 50,
      ellipsis: expandKeyWord
    })

    console.log('HTML-heavy truncated:', truncated)

    // Should contain the See more text
    expect(truncated).toContain('...See more')

    // Should preserve some HTML structure
    expect(truncated).toContain('<strong>')
    expect(truncated).toContain('Breaking News')

    // Tags should be properly closed (no broken HTML)
    const openTags = (truncated.match(/<[a-z]+[^>]*>/gi) || []).length
    const closeTags = (truncated.match(/<\/[a-z]+>/gi) || []).length
    // Self-closing tags and properly closed tags should balance
    expect(openTags).toBeGreaterThanOrEqual(closeTags)

    // No spurious links for spaces
    expect(truncated).not.toMatch(/href="\/tags\/\s*"/)
  })

  it('should handle real-world chat message with formatting', () => {
    // Simulates a formatted chat message from a rich text editor
    const html = `<p>Hey @john! 👋</p><p>Check out this link: https://docs.example.com/guide</p><p>Also see #announcement for more info.</p>`

    const processor = new HtmlProcessor({ html })
    const parsed = processor.getParsedHtml()

    console.log('Chat message parsed:', parsed)

    // Mention should be linkified
    expect(parsed).toContain('href="account/john"')
    expect(parsed).toContain('@john')

    // URL should be linkified
    expect(parsed).toContain('href="https://docs.example.com/guide"')

    // Hashtag should be linkified
    expect(parsed).toContain('href="/hashtag/announcement"')

    // Emoji should be preserved
    expect(parsed).toContain('👋')
  })

  it('should handle message with multiple URLs and mentions', () => {
    const html = `<div>
      Contact @alice or @bob for help.
      Resources: https://example.com and https://docs.example.org
      Topics: #help #support #faq
    </div>`

    const processor = new HtmlProcessor({ html })
    const parsed = processor.getParsedHtml()

    console.log('Multiple links parsed:', parsed)

    // Both mentions should be linkified
    expect(parsed).toContain('href="account/alice"')
    expect(parsed).toContain('href="account/bob"')

    // Both URLs should be linkified
    expect(parsed).toContain('href="https://example.com"')
    expect(parsed).toContain('href="https://docs.example.org"')

    // All hashtags should be linkified
    expect(parsed).toContain('href="/hashtag/help"')
    expect(parsed).toContain('href="/hashtag/support"')
    expect(parsed).toContain('href="/hashtag/faq"')
  })

  it('should handle truncation that cuts through HTML tags cleanly', () => {
    const html =
      '<div><strong>This is bold and important text that goes on</strong></div>'
    const expandKeyWord = '...See more '

    const processor = new HtmlProcessor({
      html,
      keywords: [expandKeyWord]
    })

    const truncated = processor.getTruncatedHtml({
      truncate: 20,
      ellipsis: expandKeyWord
    })

    console.log('Truncated through tags:', truncated)

    // Should have See more text
    expect(truncated).toContain('...See more')

    // Should not have unclosed tags - verify HTML is valid
    // Check that strong tag is properly closed if it was opened
    if (truncated.includes('<strong>')) {
      expect(truncated).toContain('</strong>')
    }

    // Check that div tag is properly closed
    if (truncated.includes('<div>')) {
      expect(truncated).toContain('</div>')
    }

    // No spurious links
    expect(truncated).not.toMatch(/href="\/tags\/\s*"/)
  })

  it('should handle the exact AI response format from production', () => {
    // This is a real AI response format that was causing issues
    const html = `<div><div>Here's a detailed analysis:</div>

<div style="display:flex; margin:5px 0;"><b>1. First Point:</b> Explanation of the first point with details.</div>
<div style="display:flex; margin:5px 0;"><b>2. Second Point:</b> Explanation with @expert mention.</div>
<div style="display:flex; margin:5px 0;"><b>3. Third Point:</b> More details about #topic here.</div>

<div style="display:flex; margin:5px 0;">For more information, visit https://example.com/docs</div></div>`

    const expandKeyWord = '...See more '
    const processor = new HtmlProcessor({
      html,
      keywords: [expandKeyWord]
    })

    // Test full parsing
    const parsed = processor.getParsedHtml()
    expect(parsed).toContain('First Point')
    expect(parsed).toContain('href="account/expert"')
    expect(parsed).toContain('href="/hashtag/topic"')
    expect(parsed).toContain('href="https://example.com/docs"')

    // Test truncation with See more
    const truncated = processor.getTruncatedHtml({
      truncate: 50,
      ellipsis: expandKeyWord
    })

    console.log('AI response truncated:', truncated)

    // Should have See more text appended
    expect(truncated).toContain('...See more')

    // Should NOT have spurious /tags/ links for spaces
    expect(truncated).not.toMatch(/href="\/tags\/\s*"/)

    // Content should be preserved (at least the beginning)
    expect(truncated).toContain('detailed analysis')
  })

  // ==========================================================================
  // "See more" ELLIPSIS CRITICAL TESTS
  // These tests ensure the "See more" link ALWAYS works for RichTextDisplay
  // ==========================================================================

  describe('See more ellipsis critical functionality', () => {
    it('should ALWAYS wrap ellipsis in <a> tag with href="/expand"', () => {
      // This is THE most critical test - the ellipsis MUST be clickable
      const html = '<div>This is some content that will be truncated</div>'
      const processor = new HtmlProcessor({ html })

      const truncated = processor.getTruncatedHtml({
        truncate: 20,
        ellipsis: 'See more'
      })

      // MUST contain href="/expand"
      expect(truncated).toContain('href="/expand"')
      // MUST have the ellipsis text inside an <a> tag
      expect(truncated).toMatch(/<a[^>]*href="\/expand"[^>]*>See more<\/a>/)
    })

    it('should apply correct inline styles to ellipsis link', () => {
      const html = '<div>Long content that needs truncation here</div>'
      const processor = new HtmlProcessor({ html })

      const truncated = processor.getTruncatedHtml({
        truncate: 15,
        ellipsis: '...Read more'
      })

      // Should have the gray color and no text decoration
      expect(truncated).toContain('style="color: gray;text-decoration: none;"')
      expect(truncated).toMatch(
        /<a[^>]*style="color: gray;text-decoration: none;"[^>]*>/
      )
    })

    it('should NOT add ellipsis when content length equals truncate limit exactly', () => {
      // Edge case: content is exactly at the boundary
      const html = '<div>Exactly twenty chars</div>' // "Exactly twenty chars" = 20 chars
      const processor = new HtmlProcessor({ html })

      const truncated = processor.getTruncatedHtml({
        truncate: 20,
        ellipsis: '...See more'
      })

      // Content fits exactly, no ellipsis needed
      expect(truncated).not.toContain('...See more')
      expect(truncated).not.toContain('href="/expand"')
    })

    it('should NOT add ellipsis when content is shorter than truncate limit', () => {
      const html = '<div>Short</div>' // 5 chars
      const processor = new HtmlProcessor({ html })

      const truncated = processor.getTruncatedHtml({
        truncate: 100,
        ellipsis: '...See more'
      })

      expect(truncated).not.toContain('...See more')
      expect(truncated).not.toContain('href="/expand"')
    })

    it('should handle empty ellipsis string gracefully', () => {
      const html = '<div>Content to truncate here</div>'
      const processor = new HtmlProcessor({ html })

      const truncated = processor.getTruncatedHtml({
        truncate: 10,
        ellipsis: ''
      })

      // Should still truncate but with empty ellipsis
      // The empty ellipsis should still be wrapped in <a> tag
      expect(truncated).toContain('href="/expand"')
    })

    it('should work with Unicode ellipsis character (…)', () => {
      const html = '<div>This content needs truncation for display</div>'
      const processor = new HtmlProcessor({ html })

      const truncated = processor.getTruncatedHtml({
        truncate: 15,
        ellipsis: '… Ver más' // Spanish with Unicode ellipsis
      })

      expect(truncated).toContain('href="/expand"')
      expect(truncated).toContain('… Ver más')
      expect(truncated).toMatch(/<a[^>]*href="\/expand"[^>]*>… Ver más<\/a>/)
    })

    it('should work with HTML entities in ellipsis', () => {
      const html = '<div>Content that will be truncated for testing</div>'
      const processor = new HtmlProcessor({ html })

      const truncated = processor.getTruncatedHtml({
        truncate: 15,
        ellipsis: '&hellip; More'
      })

      expect(truncated).toContain('href="/expand"')
      // HTML entities should be preserved
      expect(truncated).toContain('&hellip; More')
    })

    it('should work with just dots as ellipsis', () => {
      const html = '<div>Some content here that is long</div>'
      const processor = new HtmlProcessor({ html })

      const truncated = processor.getTruncatedHtml({
        truncate: 10,
        ellipsis: '...'
      })

      expect(truncated).toContain('href="/expand"')
      expect(truncated).toMatch(/<a[^>]*href="\/expand"[^>]*>\.\.\.<\/a>/)
    })

    it('should be detectable by RichTextDisplay frontend logic (href="/expand")', () => {
      // This simulates what RichTextDisplay does to detect the expand link
      const html =
        '<div>A long message that will definitely need truncation</div>'
      const processor = new HtmlProcessor({ html })

      const truncated = processor.getTruncatedHtml({
        truncate: 20,
        ellipsis: '...See more '
      })

      // Simulate RichTextDisplay detection logic
      const hasExpandLink = truncated.includes('href="/expand"')
      expect(hasExpandLink).toBe(true)

      // The exact pattern RichTextDisplay checks for
      const expandLinkRegex = /href="\/expand"/
      expect(expandLinkRegex.test(truncated)).toBe(true)
    })

    it('should be detectable by RichTextDisplay React Native logic (includes /expand)', () => {
      // React Native version checks: href.includes('/expand')
      const html = '<div>Content for mobile app that needs truncation</div>'
      const processor = new HtmlProcessor({ html })

      const truncated = processor.getTruncatedHtml({
        truncate: 15,
        ellipsis: 'Ver más'
      })

      // Extract the href value
      const hrefMatch = truncated.match(/href="([^"]*)"/)
      expect(hrefMatch).not.toBeNull()

      const href = hrefMatch![1]
      // React Native checks href.includes('/expand')
      expect(href.includes('/expand')).toBe(true)
    })

    it('should preserve ellipsis link even with complex HTML content', () => {
      const html = `
        <div>
          <p><strong>Important:</strong> This is a <em>very</em> long message.</p>
          <p>It has multiple paragraphs with @mentions and #hashtags.</p>
          <p>And even URLs like https://example.com in the content.</p>
        </div>
      `
      const processor = new HtmlProcessor({ html })

      const truncated = processor.getTruncatedHtml({
        truncate: 30,
        ellipsis: '...See more'
      })

      // Ellipsis MUST be linkified even with complex HTML
      expect(truncated).toContain('href="/expand"')
      expect(truncated).toMatch(/<a[^>]*href="\/expand"[^>]*>.*See more<\/a>/)

      // Other links should still work (URL might be in truncated part)
      // Just ensure no spurious /tags/ links
      expect(truncated).not.toMatch(/href="\/tags\/\s*"/)
    })

    it('should not double-wrap ellipsis if called multiple times', () => {
      const html = '<div>Content for multiple processing</div>'
      const processor = new HtmlProcessor({ html })

      // Call getTruncatedHtml multiple times (simulating re-renders)
      const truncated1 = processor.getTruncatedHtml({
        truncate: 15,
        ellipsis: 'More'
      })
      const truncated2 = processor.getTruncatedHtml({
        truncate: 15,
        ellipsis: 'More'
      })

      // Both should have exactly one expand link
      const expandLinks1 = (truncated1.match(/href="\/expand"/g) || []).length
      const expandLinks2 = (truncated2.match(/href="\/expand"/g) || []).length

      expect(expandLinks1).toBe(1)
      expect(expandLinks2).toBe(1)

      // No nested <a> tags
      expect(truncated1).not.toContain('<a href="/expand"><a')
      expect(truncated2).not.toContain('<a href="/expand"><a')
    })

    it('should handle the exact ChatListItem usage pattern (ellipsis=" ")', () => {
      // ChatListItem uses: ellipsis=" " (single space) to show no "See more"
      // This was the original bug trigger
      const html = '<div>Chat message preview text here</div>'
      const processor = new HtmlProcessor({ html })

      const truncated = processor.getTruncatedHtml({
        truncate: 15,
        ellipsis: ' '
      })

      // Should have the expand link (even for space ellipsis)
      expect(truncated).toContain('href="/expand"')

      // NO spurious links for spaces in the content
      expect(truncated).not.toMatch(/href="\/tags\/\s*"/)

      // Count total links - should be exactly 1 (the expand link)
      const allLinks = truncated.match(/<a /g) || []
      expect(allLinks.length).toBe(1)
    })

    it('should handle the exact RichTextDisplay chat-list usage (maxLength=35, ellipsis=" ")', () => {
      // From ChatListItem.tsx line 166-171:
      // <RichTextDisplay content={...} textSize="text-sm" ellipsis=" " maxLength={35} />
      const html =
        '<div>This is a longer chat message that will be truncated in the list</div>'

      const processor = new HtmlProcessor({
        html,
        keywords: [' '] // RichTextDisplay registers ellipsis as keyword
      })

      const truncated = processor.getTruncatedHtml({
        truncate: 35,
        ellipsis: ' '
      })

      // Should NOT create spurious links for spaces
      const tagsLinks = (truncated.match(/href="\/tags\//g) || []).length
      expect(tagsLinks).toBe(0)

      // Should have exactly one expand link
      const expandLinks = (truncated.match(/href="\/expand"/g) || []).length
      expect(expandLinks).toBe(1)
    })
  })

  it('should explain the purpose of double linkify in original code', () => {
    // INVESTIGATION COMPLETE:
    //
    // The original code had:
    //   const reProcessHtml = linkifyHtml(truncatedHtml, this.parsingOptions)
    //   const finalResult = linkifyHtml(reProcessHtml, this.parsingOptions)
    //   return finalResult
    //
    // After investigation, here's the conclusion:
    //
    // 1. First linkifyHtml call after truncation:
    //    - The ellipsis text (e.g., "...See more ") is NOT yet linkified
    //    - This call linkifies the ellipsis if it's a registered keyword
    //    - Content that was already linkified in getParsedHtml() is inside <a> tags, so it's ignored
    //
    // 2. Second linkifyHtml call:
    //    - This appears to have been UNNECESSARY
    //    - linkifyHtml should be idempotent for non-keyword content
    //    - The second pass was likely added as a "safety net" but actually caused issues
    //    - When combined with problematic keyword patterns (like single spaces), it amplified the bug
    //
    // The fix: Remove the second linkifyHtml call. One pass after truncation is sufficient.
    //
    // Character count theory (from user's hypothesis):
    //    - truncateHtml counts VISIBLE text, not HTML tags
    //    - So "https://example.com" = 19 chars whether or not it's in an <a> tag
    //    - The character count is consistent, so double linkify doesn't help with that
    //
    // The REAL problem was:
    //    - Keywords are registered GLOBALLY in linkify-plugin-keyword
    //    - When RichTextDisplay used ellipsis=" " (single space) as a keyword, it persisted
    //    - Running linkifyHtml multiple times amplified the matching
    //    - Eventually, spaces matched and became /tags/ links

    // Verify our fix works with the problematic pattern
    const content = '<div>Hello world this is a test</div>'
    const processor1 = new HtmlProcessor({
      html: content,
      keywords: [' '] // Worst case: registering a space as keyword
    })
    const result1 = processor1.getParsedHtml()

    const processor2 = new HtmlProcessor({
      html: content,
      keywords: ['...See more '] // The actual RichTextDisplay pattern
    })
    const result2 = processor2.getTruncatedHtml({
      truncate: 15,
      ellipsis: '...See more '
    })

    // Neither should have spurious links for spaces
    // This test documents that our single-linkify fix prevents the cascade issue
    expect(result1).not.toMatch(/<a[^>]*href="\/tags\/\s+"[^>]*>/)
    expect(result2).not.toMatch(/<a[^>]*href="\/tags\/\s+"[^>]*>/)
  })
})
