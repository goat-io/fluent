const defaultOptions = {
  headings: 'h1, h2',
  scope: '.markdown-section',

  // To make work
  title: 'Contents',
  listType: 'ul'
}

// Element builders
const _tocHeading = Title =>
  document.createElement('h2').appendChild(document.createTextNode(Title))

const aTag = src => {
  const a = document.createElement('a')
  const content = src.firstChild.innerHTML

  // Use this to clip text w/ HTML in it.
  // https://github.com/arendjr/text-clipper
  a.innerHTML = content
  a.href = src.firstChild.href
  a.onclick = tocClick

  // In order to remove this gotta fix the styles.
  a.setAttribute('class', 'anchor')

  return a
}

const tocClick = e => {
  const divs = document.querySelectorAll('.page_toc .active')

  // Remove the previous classes
  ;[].forEach.call(divs, div => {
    div.setAttribute('class', 'anchor')
  })

  // Make sure this is attached to the parent not itself
  e.target.parentNode.setAttribute('class', 'active')
}

const createList = (wrapper, count) => {
  if (!wrapper) {
    return
  }
  let currentWrapper = wrapper
  let remainingCount = count
  while (remainingCount--) {
    currentWrapper = currentWrapper.appendChild(document.createElement('ul'))

    if (remainingCount) {
      currentWrapper = currentWrapper.appendChild(document.createElement('li'))
    }
  }

  return currentWrapper
}

//------------------------------------------------------------------------

const getHeaders = selector => {
  const headings2 = document.querySelectorAll(selector)
  let ret = []

  ;[].forEach.call(headings2, heading => {
    ret = ret.concat(heading)
  })

  return ret
}

const getLevel = header => {
  const decs = header.match(/\d/g)

  return decs ? Math.min.apply(null, decs) : 1
}

const jumpBack = (currentWrapper, offset) => {
  let wrapper = currentWrapper
  let remainingOffset = offset
  while (remainingOffset--) {
    wrapper = wrapper.parentElement
  }

  return wrapper
}

const buildTOC = options => {
  const ret = document.createElement('ul')
  let wrapper = ret
  let lastLi = null
  const selector = `${options.scope} ${options.headings}`
  const headers = getHeaders(selector).filter(h => h.id)

  headers.reduce((prev, curr, _index) => {
    const currentLevel = getLevel(curr.tagName)
    const offset = currentLevel - prev

    wrapper =
      offset > 0 ? createList(lastLi, offset) : jumpBack(wrapper, -offset * 2)

    wrapper = wrapper || ret

    const li = document.createElement('li')

    wrapper.appendChild(li).appendChild(aTag(curr))

    lastLi = li

    return currentLevel
  }, getLevel(options.headings))

  return ret
}

// Docsify plugin functions
function plugin(hook, vm) {
  const userOptions = vm.config.toc

  hook.mounted(() => {
    const content = window.Docsify.dom.find('.content')
    if (content) {
      const nav = window.Docsify.dom.create('aside', '')
      window.Docsify.dom.toggleClass(nav, 'add', 'nav')
      window.Docsify.dom.before(content, nav)
    }
  })

  hook.doneEach(() => {
    const nav = document.querySelectorAll('.nav')[0]
    const _t = Array.from(document.querySelectorAll('.nav'))

    if (!nav) {
      return
    }

    const toc = buildTOC(userOptions)

    // Just unset it for now.
    if (!toc.innerHTML) {
      nav.innerHTML = null
      return
    }

    // Fix me in the future
    const title = document.createElement('p')
    title.innerHTML = userOptions.title
    title.setAttribute('class', 'title')

    const container = document.createElement('div')
    container.setAttribute('class', 'page_toc')

    container.appendChild(title)
    container.appendChild(toc)

    // Existing TOC
    const tocChild = document.querySelectorAll('.nav .page_toc')

    if (tocChild.length > 0) {
      tocChild[0].parentNode.removeChild(tocChild[0])
    }

    nav.appendChild(container)
  })
}

// Docsify plugin options
window.$docsify.toc = Object.assign(defaultOptions, window.$docsify.toc)
window.$docsify.plugins = [].concat(plugin, window.$docsify.plugins)
