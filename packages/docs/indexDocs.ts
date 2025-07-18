import fs from 'fs'
import { algoliasearch } from 'algoliasearch'
import matter from 'gray-matter'

require('dotenv').config()

// Algolia's record size limit is 10KB, use 6KB for aggressive chunking
const MAX_RECORD_SIZE = 6000 // 6KB in bytes

// Function to split large content into smaller chunks
const chunkContent = (content: string, maxSize: number = MAX_RECORD_SIZE): string[] => {
  if (Buffer.byteLength(content, 'utf8') <= maxSize) {
    return [content]
  }

  const chunks: string[] = []
  const lines = content.split('\n')
  let currentChunk = ''

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const testChunk = currentChunk + (currentChunk ? '\n' : '') + line
    
    if (Buffer.byteLength(testChunk, 'utf8') > maxSize && currentChunk) {
      // Try to break at a good spot (heading, empty line, or paragraph)
      const isHeading = line.startsWith('#')
      const isEmptyLine = line.trim() === ''
      const isCodeBlock = line.startsWith('```')
      
      // If current line is a good break point, break before it
      if (isHeading || isEmptyLine || isCodeBlock) {
        chunks.push(currentChunk.trim())
        currentChunk = line
      } else {
        // Otherwise, include current line and break here
        chunks.push(testChunk.trim())
        currentChunk = ''
      }
    } else {
      currentChunk = testChunk
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim())
  }

  return chunks.filter(chunk => chunk.length > 0)
}

const findThirdLevelHashes = (text: string) => {
  const re = /([^\n]+)(## [^\n#]+|[^\n#]+##)(?=$|\n)/g
  const hits: {
    found: string
    index: number
  }[] = []

  // Iterate hits
  let match: RegExpExecArray | null = null
  do {
    match = re.exec(text)
    const index = re.lastIndex

    if (match) {
      hits.push({
        found: match[0].replace(/#/g, '').trim(),
        index,
      })
    }
  } while (match)
  return hits
}

const findSecondLevelHashes = (text: string) => {
  const re = /([^\n]+)(# [^\n#]+|[^\n#]+#)(?=$|\n)/g
  const hits: {
    found: string
    index: number
  }[] = []
  // Iterate hits
  let match: RegExpExecArray | null = null
  do {
    match = re.exec(text)
    const index = re.lastIndex
    if (match && !match[0].includes('###')) {
      hits.push({
        found: match[0].replace(/#/g, '').trim(),
        index,
      })
    }
  } while (match)
  return hits
}

const getMenuName = (slug: string): string => {
  if (slug.startsWith('/0.1.x/overview/')) {
    return '🎯 Getting Started'
  }
  if (slug.startsWith('/0.1.x/getting-started/')) {
    return '🎯 Getting Started'
  }
  if (slug.startsWith('/0.1.x/architecture/')) {
    return '🏗️ Architecture'
  }
  if (slug.startsWith('/0.1.x/features/')) {
    return '🚀 Features'
  }
  if (slug.startsWith('/0.1.x/development/')) {
    return '🔧 Development'
  }
  if (slug.startsWith('/0.1.x/deployment/')) {
    return '🏭 Deployment'
  }
  if (slug.startsWith('/0.1.x/integrations/')) {
    return '🔌 Integrations'
  }
  if (slug.startsWith('/0.1.x/sodium-cli/')) {
    return '🛠️ Sodium CLI'
  }
  if (slug.startsWith('/0.1.x/api/')) {
    return '📚 API Reference'
  }
  if (slug.startsWith('/0.1.x/new-apps/')) {
    return '🚀 Creating New Apps'
  }
  if (slug.startsWith('/0.1.x/advanced/')) {
    return '⚙️ Advanced Topics'
  }
  if (slug.startsWith('/0.1.x/commerce/')) {
    return '💰 Commerce'
  }
  if (slug.startsWith('/0.1.x/push-notifications/')) {
    return '🔌 Integrations'
  }
  if (slug.startsWith('/0.1.x/legacy-rn/') || slug.startsWith('/0.1.x/other/')) {
    return '📖 Legacy & Other'
  }

  return 'Documentation'
}

;(async () => {
  const { globby } = await import('globby')

  const pages = await globby(['0.1.x/**/*.md'])

  const objects: any[] = []
  
  pages.forEach((page: string) => {
    const fileContents = fs.readFileSync(page, 'utf8')

    const { content } = matter(fileContents)
    const path = page.replace('.md', '')
    let slug = path === 'docs/index' ? 'docs' : path
    slug = '/' + slug + '/'

    const title = content.split('\n')[0].replace(/#/g, '').trim()
    const menu = getMenuName(slug)

    // Create search snippet from first few lines (excluding title)
    const contentLines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'))
    const searchSnippet = contentLines.slice(0, 3).join(' ').substring(0, 200) + (contentLines.join(' ').length > 200 ? '...' : '')

    // Check if content needs to be chunked
    const contentChunks = chunkContent(content)
    
    if (contentChunks.length === 1) {
      // Single chunk - process normally
      const secondLevel = findSecondLevelHashes(content)
      const thirdLevel = findThirdLevelHashes(content)
      
      objects.push({
        objectID: slug,
        slug,
        content,
        title,
        menu,
        searchSnippet,
        secondLevel,
        thirdLevel,
        isChunked: false,
      })
    } else {
      // Multiple chunks - create separate records for each chunk
      contentChunks.forEach((chunk, index) => {
        const secondLevel = findSecondLevelHashes(chunk)
        const thirdLevel = findThirdLevelHashes(chunk)
        
        // Create chunk-specific snippet
        const chunkLines = chunk.split('\n').filter(line => line.trim() && !line.startsWith('#'))
        const chunkSnippet = chunkLines.slice(0, 2).join(' ').substring(0, 150) + (chunkLines.join(' ').length > 150 ? '...' : '')
        
        objects.push({
          objectID: `${slug}#chunk-${index}`,
          slug,
          content: chunk,
          title: index === 0 ? title : `${title} (Part ${index + 1})`,
          menu,
          searchSnippet: chunkSnippet,
          secondLevel,
          thirdLevel,
          chunkIndex: index,
          totalChunks: contentChunks.length,
          isChunked: true,
        })
      })
    }
  })
  console.log('THE FOLLOWING DOCS WILL BE INDEXED')

  // Check for oversized objects before sending
  const oversized = objects.filter(obj => {
    const size = Buffer.byteLength(JSON.stringify(obj), 'utf8')
    if (size > 10000) {
      console.log(`WARNING: Object ${obj.objectID} is ${size} bytes (over 10KB limit)`)
      return true
    }
    return false
  })

  if (oversized.length > 0) {
    console.log(`Found ${oversized.length} oversized objects that will fail indexing`)
    oversized.forEach(obj => {
      console.log(`- ${obj.objectID}: ${Buffer.byteLength(JSON.stringify(obj), 'utf8')} bytes`)
    })
  }

  console.log('INDEXING', objects.length, ' pages')
  const client = algoliasearch('FNFI485NDK', process.env.ALGOLIA_ADMIN_TOKEN!)

  // await index.delete()
  await client.saveObjects({
    indexName: process.env.ALGOLIA_INDEX_NAME!,
    objects,
  })

  console.log('ALL PAGES INDEXED')
})()
