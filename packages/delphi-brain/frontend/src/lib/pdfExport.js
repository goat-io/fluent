/**
 * Generic PDF export — kicked open a new window, copies the host's CSS
 * variables + font stylesheets, calls `window.print()`. The browser's
 * "Save as PDF" handles the rest. No heavy lib required.
 *
 * Two layouts:
 *   - **Slides**: when `slideCount > 0`, the whole deck prints as ONE tall
 *     page (1280 × N×720 px). Background colour is preserved with
 *     print-color-adjust. Each `.print-slide` has min-height 720 so a short
 *     slide still fills its slot. Long slides expand. This is the pattern
 *     the OKR deck used and it produces clean continuous output.
 *   - **Markdown / single doc**: portrait pages with normal page breaks.
 *
 * The caller passes the offscreen container that holds the full rendered
 * content (every slide stacked, or the markdown body).
 */
export function exportPDF(containerEl, { title = 'Document', slideCount = 0, isEmbedded = false } = {}) {
  if (!containerEl) return
  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  const root = document.documentElement
  const cs = getComputedStyle(root)
  const vars = [
    '--background', '--surface', '--surface-raised', '--surface-overlay',
    '--border', '--text-muted', '--text', '--text-heading',
    '--status-success', '--status-warning', '--status-danger', '--status-info',
    '--accent', '--font-sans', '--font-mono',
  ].map((v) => `${v}: ${cs.getPropertyValue(v)};`).join('\n    ')

  const fontLinks = [...document.querySelectorAll('link[rel="stylesheet"]')]
    .map((l) => l.outerHTML)
    .join('\n')

  // ── Slides: one page per slide, dynamic height. Each .print-slide is
  //    measured live; the resulting @page rule sizes the printed sheet to fit
  //    its content (with a 720px minimum so short slides still feel like
  //    slides). Avoids the previous "fixed 100vh + overflow:hidden" clipping.
  let perSlidePages = ''
  let perSlideClasses = ''
  const SLIDE_W = 1280
  const SLIDE_MIN_H = 720
  // print CSS below adds 36px top + 36px bottom padding inside .print-slide;
  // the offscreen render in DocumentShell has no such padding, so its
  // scrollHeight is short. Add the padding budget to each measured height
  // (plus a safety margin) so no content spills onto a second sheet.
  const SLIDE_VERT_PAD = 36 * 2
  const SLIDE_SAFETY = 8
  if (slideCount > 0) {
    const slideEls = [...containerEl.querySelectorAll('.print-slide')]
    const heights = slideEls.map((el) => {
      const measured = Math.max(el.scrollHeight, el.offsetHeight)
      return Math.max(measured + SLIDE_VERT_PAD + SLIDE_SAFETY, SLIDE_MIN_H)
    })
    perSlidePages = heights
      .map((h, i) => `@page slide${i} { size: ${SLIDE_W}px ${h}px; margin: 0; }`)
      .join('\n    ')
    perSlideClasses = heights
      .map((_, i) => `.print-slide:nth-of-type(${i + 1}) { page: slide${i}; min-height: ${SLIDE_MIN_H}px; }`)
      .join('\n    ')
  }
  const slidesCss = slideCount > 0 ? `
    ${perSlidePages}
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: ${cs.getPropertyValue('--font-sans') || '"Inter", sans-serif'};
      background: var(--background);
      color: var(--text);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-slide {
      page-break-after: always;
      break-after: page;
      page-break-inside: avoid;
      padding: 36px 48px;
      width: ${SLIDE_W}px;
      min-height: ${SLIDE_MIN_H}px;
      background: var(--background);
      position: relative;
    }
    ${perSlideClasses}
    .print-slide:last-child {
      page-break-after: avoid;
      break-after: auto;
    }
  ` : ''

  // ── Embedded diagram (React Flow / SVG / canvas snapshot). Landscape,
  //    full-bleed, capture container dimensions so the diagram doesn't
  //    overflow or shrink. We also copy a stylesheet snapshot from the host
  //    document because React Flow injects styles via @emotion / classnames.
  const rect = isEmbedded ? containerEl.getBoundingClientRect() : null
  const embeddedCss = isEmbedded ? `
    @page { size: ${rect.width}px ${rect.height}px; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: ${cs.getPropertyValue('--font-sans') || '"Inter", sans-serif'};
      background: var(--background);
      color: var(--text);
      width: ${rect.width}px;
      height: ${rect.height}px;
      overflow: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-embedded {
      width: ${rect.width}px;
      height: ${rect.height}px;
      position: relative;
    }
    /* React Flow viewport already has the right transforms; don't override. */
  ` : ''

  // Collect host stylesheets so React Flow / hljs / emotion styles render.
  const inlineStyles = isEmbedded
    ? [...document.querySelectorAll('style')]
        .map((s) => s.outerHTML)
        .join('\n')
    : ''

  // ── Markdown / single doc: portrait pages, max-width column. ─────────
  const docCss = slideCount === 0 && !isEmbedded ? `
    @page { size: portrait; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      font-family: ${cs.getPropertyValue('--font-sans') || '"Inter", sans-serif'};
      background: var(--background);
      color: var(--text);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .print-doc {
      padding: 36px 48px 60px;
      max-width: 880px;
      margin: 0 auto;
    }
  ` : ''

  // Embedded views wrap the live snapshot in a fixed-size box so React
  // Flow's absolute-positioned children land at the right coordinates.
  const bodyHtml = isEmbedded
    ? `<div class="print-embedded">${containerEl.innerHTML}</div>`
    : containerEl.innerHTML

  printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(title)}</title>
  ${fontLinks}
  ${inlineStyles}
  <style>
    :root { ${vars} }
    ${slidesCss}
    ${docCss}
    ${embeddedCss}
  </style>
</head>
<body>${bodyHtml}</body>
</html>`)
  printWindow.document.close()

  printWindow.onload = () => {
    setTimeout(() => printWindow.print(), 500)
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
