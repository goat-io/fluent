import { escapeAttribute, escapeText } from 'entities'
import { DomUtils, parseDocument } from 'htmlparser2'
import type {
  HtmlElement,
  HtmlNode,
  HtmlParent,
  ListFrame,
} from './normalizeContentHtml.types.js'

const isElement = (node: HtmlNode): node is HtmlElement => 'attribs' in node
const blockTags = new Set([
  'address',
  'article',
  'aside',
  'blockquote',
  'details',
  'dialog',
  'div',
  'dl',
  'dt',
  'dd',
  'fieldset',
  'figcaption',
  'figure',
  'footer',
  'form',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'li',
  'main',
  'nav',
  'ol',
  'p',
  'pre',
  'section',
  'summary',
  'table',
  'tbody',
  'td',
  'tfoot',
  'th',
  'thead',
  'tr',
  'ul',
])
const isInlineContent = (node: HtmlNode | null) =>
  node !== null &&
  (node.type === 'text'
    ? node.data.trim().length > 0
    : isElement(node) &&
      !blockTags.has(node.name) &&
      !['br', 'script', 'style'].includes(node.name))
const indentation = (element: HtmlElement) => {
  const match = element.attribs.class?.match(
    /(?:^|\s)ql-indent-([1-8])(?:\s|$)/,
  )
  return match ? Number(match[1]) : 0
}
const serialize = (nodes: HtmlNode[]) =>
  DomUtils.getOuterHTML(nodes, { encodeEntities: 'utf8' })

export const parseListNumber = (
  value: string | undefined,
): number | undefined => {
  if (value === undefined || !/^[+-]?\d+$/.test(value)) {
    return undefined
  }
  const number = Number(value)
  return Number.isSafeInteger(number) ? number : undefined
}

const numberAttribute = (name: string, value: string | undefined) =>
  parseListNumber(value) !== undefined
    ? ` ${name}="${escapeAttribute(value!)}"`
    : ''

function isQuillList(element: HtmlElement) {
  return (
    (element.name === 'ol' || element.name === 'ul') &&
    element.children.some(
      child =>
        isElement(child) &&
        child.name === 'li' &&
        (child.attribs['data-list'] === 'bullet' ||
          child.attribs['data-list'] === 'ordered' ||
          indentation(child) > 0),
    )
  )
}

function canonicalList(list: HtmlElement): string {
  const output: string[] = []
  const stack: ListFrame[] = []
  const counters = new Map<number, number>()
  let usedStart = false
  const closeList = () => {
    const frame = stack.pop()
    if (frame) {
      if (frame.openItem) {
        output.push('</li>')
      }
      output.push(`</${frame.kind}>`)
    }
  }

  for (const node of list.children) {
    if (node.type === 'text' && !node.data.trim()) {
      continue
    }
    if (!isElement(node) || node.name !== 'li') {
      while (stack.length) {
        closeList()
      }
      output.push(serialize([node]))
      continue
    }

    const indent = indentation(node)
    // Quill resets only deeper counters for every item, including bullets.
    for (const depth of counters.keys()) {
      if (depth > indent) {
        counters.delete(depth)
      }
    }
    const kind =
      node.attribs['data-list'] === 'bullet'
        ? 'ul'
        : node.attribs['data-list'] === 'ordered'
          ? 'ol'
          : list.name === 'ul'
            ? 'ul'
            : 'ol'

    while (stack.length && stack[stack.length - 1]!.indent > indent) {
      closeList()
    }
    let frame = stack[stack.length - 1]
    if (frame?.indent === indent && frame.kind !== kind) {
      closeList()
      frame = stack[stack.length - 1]
    }

    let ordinal: number | undefined
    if (kind === 'ol') {
      const previous = counters.get(indent)
      const initial =
        !stack.length && !usedStart
          ? (parseListNumber(list.attribs.start) ?? 1)
          : 1
      ordinal =
        parseListNumber(node.attribs.value) ??
        (previous === undefined ? initial : previous + 1)
      counters.set(indent, ordinal)
      if (!stack.length) {
        usedStart = true
      }
    }

    if (frame?.indent === indent) {
      if (frame.openItem) {
        output.push('</li>')
      }
    } else {
      // An indentation jump opens just one list under the preceding real item.
      // Tracking source indentation keeps equally indented siblings together.
      const start =
        ordinal !== undefined && ordinal !== 1
          ? numberAttribute('start', String(ordinal))
          : ''
      output.push(`<${kind}${start}>`)
      frame = { kind, indent, openItem: false }
      stack.push(frame)
    }

    const children = node.children.filter(
      child =>
        !(
          isElement(child) &&
          child.name === 'span' &&
          child.attribs.class?.split(/\s+/).includes('ql-ui')
        ),
    )
    output.push(
      `<li${numberAttribute('value', node.attribs.value)}>${serialize(children)}`,
    )
    frame.openItem = true
  }
  while (stack.length) {
    closeList()
  }
  return output.join('')
}

function replaceWithHtml(node: HtmlNode, html: string) {
  const replacement = parseDocument(html).children
  for (const child of [...replacement]) {
    DomUtils.prepend(node, child)
  }
  DomUtils.removeElement(node)
}

function normalizeNodes(parent: HtmlParent) {
  for (const node of [...parent.children]) {
    if (node.type === 'text') {
      node.data = node.data.replace(/\r\n?/g, '\n')
      const preserveBreaks =
        node.data.trim().length > 0 ||
        (isInlineContent(node.prev) && isInlineContent(node.next))
      if (preserveBreaks && node.data.includes('\n')) {
        replaceWithHtml(node, escapeText(node.data).replace(/\n/g, '<br>'))
      }
      continue
    }
    if (!isElement(node)) {
      continue
    }
    if (node.name === 'script' || node.name === 'style') {
      continue
    }
    normalizeNodes(node)
    if (!isQuillList(node)) {
      continue
    }
    replaceWithHtml(node, canonicalList(node))
  }
}

/** Normalize structure for HTML consumers; sanitization remains the caller's responsibility. */
export function normalizeContentHtml(content: string): string {
  const document = parseDocument(content)
  if (!document.children.some(isElement)) {
    return document.children
      .map(node =>
        node.type === 'text'
          ? escapeText(node.data.replace(/\r\n?/g, '\n')).replace(/\n/g, '<br>')
          : serialize([node]),
      )
      .join('')
  }
  normalizeNodes(document)
  return serialize(document.children)
}
