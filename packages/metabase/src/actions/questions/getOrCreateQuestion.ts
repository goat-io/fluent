import { metabaseFetch } from '../../common/fetch-wrapper'

interface MetabaseQuestion {
  id: number
  name: string
  collection_id: number
  dataset_query: {
    type: string
    native?: {
      query: string
    }
    database: number
  }
  display: string
  visualization_settings?: Record<string, unknown>
}

/**
 * Configuration for creating a Metabase question
 */
export interface QuestionConfig {
  name: string
  query: string
  display?: 'scalar' | 'table' | 'line' | 'bar' | 'pie' | 'area' | 'combo'
  visualizationSettings?: Record<string, unknown>
}

/**
 * Gets an existing question by name or creates a new one
 * @param params - Question parameters and authentication
 * @returns Question ID or null if creation fails
 * @throws Error if fetching questions fails
 */
export async function getOrCreateQuestion({
  baseUrl,
  sessionToken,
  apiKey,
  collectionId,
  databaseId,
  questionConfig,
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
  collectionId: number
  databaseId: number
  questionConfig: QuestionConfig
}): Promise<number | null> {
  const {
    name,
    query,
    display = 'scalar',
    visualizationSettings = {},
  } = questionConfig


  // Fetch existing questions
  const questionsRes = await metabaseFetch({
    baseUrl,
    sessionToken,
    apiKey,
    endpoint: '/api/card',
    method: 'GET',
  })

  const questions = (await questionsRes.json()) as MetabaseQuestion[]

  // Check if question already exists in the collection
  const existingQuestion = questions.find(
    (q) => q.name === name && q.collection_id === collectionId,
  )

  if (existingQuestion) {
    return existingQuestion.id
  }


  // Create new question
  try {
    const createRes = await metabaseFetch({
      baseUrl,
      sessionToken,
      apiKey,
      endpoint: '/api/card',
      method: 'POST',
      body: {
        name,
        dataset_query: {
          type: 'native',
          native: {
            query,
            'template-tags': {}, // Empty template tags for now
          },
          database: databaseId,
        },
        display,
        visualization_settings: visualizationSettings,
        collection_id: collectionId,
        description: `Auto-generated question: ${name}`,
        cache_ttl: null, // Use default caching
        enable_embedding: false, // Can be enabled later if needed
      },
    })

    const questionData = (await createRes.json()) as MetabaseQuestion
    return questionData.id
  } catch (error) {
    console.error(`❌ Failed to create question '${name}':`, error)
    return null
  }
}
