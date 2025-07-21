# @goatlab/js-html

A TypeScript HTML processing library that provides sanitization, parsing, text extraction, and truncation capabilities with support for linkification and custom keywords.

## Installation

```bash
npm install @goatlab/js-html
```

or

```bash
yarn add @goatlab/js-html
```

## Usage

```typescript
import { HtmlProcessor } from '@goatlab/js-html';

// Basic HTML processing
const processor = new HtmlProcessor({ 
  html: '<div>Hello <b>World</b></div>' 
});

// Get sanitized and parsed HTML
const parsedHtml = processor.getParsedHtml();

// Truncate HTML with ellipsis
const truncated = processor.getTruncatedHtml({
  truncate: 50,
  ellipsis: '... Read more'
});

// Extract plain text from HTML
const text = HtmlProcessor.extractTextFromHTML('<p>Hello <b>World</b></p>');
// Output: "Hello World"

// Check if HTML is empty
const isEmpty = HtmlProcessor.isEmptyHTML('<div>   </div>');
// Output: true

// Clean HTML (remove empty tags and whitespace)
const cleaned = processor.cleanHTML('<div><p></p>Hello</div>');
```

## Key Features

- **HTML Sanitization**: Removes dangerous tags and attributes while preserving safe content
- **Text Extraction**: Extract plain text content from HTML markup
- **Smart Truncation**: Truncate HTML content while preserving tag structure
- **Empty HTML Detection**: Check if HTML contains meaningful content
- **Linkification**: Automatically convert URLs, mentions, hashtags, and custom keywords into links
- **Keyword Registration**: Define custom keywords for special link handling
- **Clean HTML**: Remove empty tags and unnecessary whitespace