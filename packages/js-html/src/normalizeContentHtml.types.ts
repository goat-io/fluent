import type { parseDocument } from 'htmlparser2'

export type HtmlNode = ReturnType<typeof parseDocument>['children'][number]
export type HtmlElement = Extract<HtmlNode, { attribs: Record<string, string> }>
export type HtmlParent = ReturnType<typeof parseDocument> | HtmlElement

export interface ListFrame {
  kind: 'ul' | 'ol'
  indent: number
  openItem: boolean
}
