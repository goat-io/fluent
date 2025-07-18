# JS HTML Package

The `@goatlab/js-html` package provides powerful HTML processing utilities for sanitization, parsing, link detection, and content manipulation. It's designed for both browser and Node.js environments.

## Installation

```bash
npm install @goatlab/js-html
# or
pnpm add @goatlab/js-html
```

## Core Features

### HtmlProcessor

The main class for HTML processing and manipulation.

```typescript
import { HtmlProcessor } from '@goatlab/js-html'

// Create processor instance
const processor = new HtmlProcessor({
  html: '<p>Hello <strong>world</strong>!</p>',
  keywords: ['hello', 'world'] // Optional keywords for highlighting
})
```

## HTML Sanitization and Parsing

### Basic Processing

```typescript
import { HtmlProcessor } from '@goatlab/js-html'

const html = `
  <div>
    <p>Hello <strong>world</strong>!</p>
    <script>alert('xss')</script>
    <a href="https://example.com">Link</a>
  </div>
`

const processor = new HtmlProcessor({ html })

// Get sanitized and parsed HTML
const sanitized = processor.getParsedHtml()
console.log(sanitized)
// Output: <div><p>Hello <strong>world</strong>!</p><a href="https://example.com">Link</a></div>
```

### Allowed Tags and Attributes

The processor sanitizes HTML by allowing only safe tags and attributes:

- **Allowed tags**: `b`, `i`, `em`, `strong`, `a`, `p`, `div`, `br`
- **Allowed attributes**: 
  - `a` tags: `href`
  - `div` tags: `style`

```typescript
const unsafeHtml = `
  <p>Safe content</p>
  <script>alert('unsafe')</script>
  <img src="javascript:alert('xss')" />
  <a href="https://safe.com" onclick="alert('unsafe')">Link</a>
`

const processor = new HtmlProcessor({ html: unsafeHtml })
const safe = processor.getParsedHtml()
// Script and img tags removed, onclick attribute stripped
```

## Link Detection and Enhancement

### Automatic Link Detection

The processor automatically detects and converts various types of links:

```typescript
const textWithLinks = `
  Check out https://example.com
  Email me at user@example.com
  Follow @username on social media
  See issue #123 for details
  Search for #hashtag
`

const processor = new HtmlProcessor({ html: textWithLinks })
const withLinks = processor.getParsedHtml()
// Converts URLs, emails, mentions, hashtags, and tickets to clickable links
```

### Link Types

#### URLs
```typescript
const html = 'Visit https://example.com for more info'
const processor = new HtmlProcessor({ html })
const result = processor.getParsedHtml()
// <a href="https://example.com">https://example.com</a>
```

#### Email Addresses
```typescript
const html = 'Contact us at support@example.com'
const processor = new HtmlProcessor({ html })
const result = processor.getParsedHtml()
// <a href="mailto:support@example.com">support@example.com</a>
```

#### Social Media Mentions
```typescript
const html = 'Thanks @johnsmith for the help!'
const processor = new HtmlProcessor({ html })
const result = processor.getParsedHtml()
// <a href="account@johnsmith">@johnsmith</a>
```

#### Hashtags
```typescript
const html = 'Check out this #awesome feature'
const processor = new HtmlProcessor({ html })
const result = processor.getParsedHtml()
// <a href="/hashtag/awesome">#awesome</a>
```

#### Ticket References
```typescript
const html = 'Fixed in ticket #123'
const processor = new HtmlProcessor({ html })
const result = processor.getParsedHtml()
// <a href="/issues/123">#123</a>
```

## Keyword Highlighting

### Register Keywords

```typescript
const processor = new HtmlProcessor({ 
  html: 'This is important content',
  keywords: ['important', 'content']
})

// Add more keywords
processor.registerKeywords(['urgent', 'critical'])

const highlighted = processor.getParsedHtml()
// Keywords are converted to styled links
```

### Custom Keyword Styling

```typescript
const processor = new HtmlProcessor({ html: 'content' })

// Customize keyword appearance
processor.parsingOptions.attributes = (href, element) => {
  if (element === 'keyword') {
    return {
      style: 'color: blue; background: yellow; text-decoration: none;'
    }
  }
  return {}
}
```

## Content Truncation

### Basic Truncation

```typescript
const longHtml = '<p>This is a very long piece of content that needs to be truncated...</p>'
const processor = new HtmlProcessor({ html: longHtml })

const truncated = processor.getTruncatedHtml({
  truncate: 50, // Character limit
  ellipsis: '...Read more'
})
```

### Smart Truncation

The truncation preserves HTML structure and doesn't break in the middle of tags:

```typescript
const html = '<p>Long <strong>formatted</strong> content here...</p>'
const processor = new HtmlProcessor({ html })

const truncated = processor.getTruncatedHtml({
  truncate: 20,
  ellipsis: '<a href="/full-post">See more</a>'
})
// Properly closes tags and maintains structure
```

## Static Utility Methods

### Check if HTML is Empty

```typescript
const emptyHtml = '<p></p><div>   </div>'
const isEmpty = HtmlProcessor.isEmptyHTML(emptyHtml) // true

const notEmpty = '<p>Content</p>'
const isNotEmpty = HtmlProcessor.isEmptyHTML(notEmpty) // false
```

### Extract Text from HTML

```typescript
const html = '<p>Hello <strong>world</strong>!</p><script>alert("test")</script>'
const text = HtmlProcessor.extractTextFromHTML(html)
console.log(text) // "Hello world!"
// Script content is ignored
```

### Handle Line Breaks

```typescript
const htmlWithBr = '<p>Line 1<br>Line 2</p>'
const text = HtmlProcessor.extractTextFromHTML(htmlWithBr)
console.log(text) // "Line 1\nLine 2"
// <br> tags are converted to newlines
```

## HTML Cleaning

### Remove Empty Tags

```typescript
const processor = new HtmlProcessor({ html: 'content' })

const dirtyHtml = '<p></p><div>Content</div><span>   </span>'
const clean = processor.cleanHTML(dirtyHtml)
// Returns: '<div>Content</div>'
// Empty tags and whitespace-only tags are removed
```

### Recursive Cleaning

```typescript
const nestedEmpty = '<div><p></p><span><em></em></span></div>'
const processor = new HtmlProcessor({ html: nestedEmpty })
const clean = processor.cleanHTML(nestedEmpty)
// Returns: '' (all nested empty tags removed)
```

## Advanced Configuration

### Custom Parsing Options

```typescript
const processor = new HtmlProcessor({ html: 'content' })

// Customize link formatting
processor.parsingOptions = {
  attributes: (href, element) => {
    if (element === 'hashtag') {
      return { style: 'color: green; text-decoration: none;' }
    }
    return {}
  },
  formatHref: {
    hashtag: href => `/tags/${href.substr(1).toLowerCase()}`,
    mention: href => `/users/${href.substr(1)}`,
    ticket: href => `/issues/${href.substr(1)}`
  },
  defaultProtocol: 'https',
  target: { url: '_blank' },
  rel: { url: 'noopener noreferrer' }
}
```

### Transform Tags

```typescript
const processor = new HtmlProcessor({ html: 'content' })

// Custom tag transformations during sanitization
// (This would require extending the sanitization options)
```

## Real-world Examples

### Social Media Post Processing

```typescript
const socialPost = `
  Hey @everyone! Check out this amazing #JavaScript library: 
  https://github.com/example/repo
  
  It solves issue #42 we've been discussing.
  
  <script>alert('xss')</script>
`

const processor = new HtmlProcessor({ 
  html: socialPost,
  keywords: ['JavaScript', 'library']
})

const processedPost = processor.getParsedHtml()
// - XSS script removed
// - URLs converted to links
// - Mentions and hashtags linked
// - Keywords highlighted
```

### Blog Post Excerpt

```typescript
const blogPost = `
  <article>
    <h2>Getting Started with Node.js</h2>
    <p>Node.js is a powerful runtime for building server-side applications...</p>
    <p>In this tutorial, we'll cover the basics and advanced concepts...</p>
  </article>
`

const processor = new HtmlProcessor({ 
  html: blogPost,
  keywords: ['Node.js', 'tutorial']
})

const excerpt = processor.getTruncatedHtml({
  truncate: 100,
  ellipsis: '<a href="/blog/nodejs-tutorial">Read full article</a>'
})
```

### Comment System

```typescript
class CommentProcessor {
  static processComment(rawComment: string): string {
    const processor = new HtmlProcessor({ 
      html: rawComment,
      keywords: ['important', 'urgent', 'breaking']
    })
    
    // Check if comment is just empty HTML
    if (processor.isHTMLEmpty()) {
      return ''
    }
    
    // Process and return sanitized comment
    return processor.getParsedHtml()
  }
  
  static getCommentPreview(comment: string): string {
    const processor = new HtmlProcessor({ html: comment })
    return processor.getTruncatedHtml({
      truncate: 150,
      ellipsis: '...'
    })
  }
}
```

### Rich Text Editor Integration

```typescript
class RichTextEditor {
  private processor: HtmlProcessor
  
  constructor(content: string = '') {
    this.processor = new HtmlProcessor({ html: content })
  }
  
  setContent(html: string): void {
    this.processor = new HtmlProcessor({ html })
  }
  
  getCleanContent(): string {
    return this.processor.getParsedHtml()
  }
  
  getPreview(maxLength: number = 200): string {
    return this.processor.getTruncatedHtml({
      truncate: maxLength,
      ellipsis: '...'
    })
  }
  
  isEmpty(): boolean {
    return this.processor.isHTMLEmpty()
  }
  
  getPlainText(): string {
    return HtmlProcessor.extractTextFromHTML(this.processor.getParsedHtml())
  }
}
```

## Security Considerations

### XSS Prevention

The package automatically sanitizes HTML to prevent XSS attacks:

```typescript
const maliciousHtml = `
  <img src="x" onerror="alert('XSS')">
  <script>document.cookie = 'stolen'</script>
  <iframe src="javascript:alert('XSS')"></iframe>
`

const processor = new HtmlProcessor({ html: maliciousHtml })
const safe = processor.getParsedHtml()
// All malicious elements and attributes are removed
```

### Safe Link Processing

Links are processed safely with proper protocols:

```typescript
const unsafeLinks = `
  <a href="javascript:alert('xss')">Malicious</a>
  <a href="data:text/html,<script>alert('xss')</script>">Data URL</a>
`

const processor = new HtmlProcessor({ html: unsafeLinks })
const safe = processor.getParsedHtml()
// Unsafe href attributes are removed or sanitized
```

## Performance Tips

1. **Reuse instances**: Create one processor instance and reuse it for similar content
2. **Batch processing**: Process multiple pieces of content in batches
3. **Cache results**: Cache processed HTML for frequently accessed content
4. **Limit keywords**: Don't register too many keywords as it affects performance

## Error Handling

```typescript
try {
  const processor = new HtmlProcessor({ html: invalidHtml })
  const result = processor.getParsedHtml()
} catch (error) {
  console.error('HTML processing failed:', error)
  // Fallback to plain text or default content
}
```

## Contributing

The js-html package is part of the Goat Fluent ecosystem. See the main documentation for contribution guidelines.