export async function getOrCreateAccountsQuestion({
  mbToken,
  collectionId,
  databaseId,
  baseUrl,
}: {
  mbToken: string
  collectionId: string
  databaseId: string
  baseUrl: string
}) {
  // Fetch existing questions in the collection
  const questionsRes = await fetch(`${baseUrl}/api/card`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-Metabase-Session': mbToken,
    },
  })

  if (!questionsRes.ok) {
    console.error('❌ Failed to fetch questions:', await questionsRes.text())
    return
  }

  const questions = (await questionsRes.json()) as Array<{
    id: number
    name: string
    collection_id: string
  }>

  // Check if "# Accounts" question already exists in the collection
  const existingQuestion = questions.find(
    q => q.name === '# Accounts' && q.collection_id === collectionId,
  )

  if (existingQuestion) {
    return existingQuestion.id
  }

  // Create new question
  const createRes = await fetch(`${baseUrl}/api/card`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Metabase-Session': mbToken,
    },
    body: JSON.stringify({
      name: '# Accounts',
      dataset_query: {
        type: 'native',
        native: {
          query: 'SELECT COUNT(*) AS `count` FROM `accounts`',
        },
        database: databaseId, // This should match your MySQL database ID in Metabase
      },
      display: 'scalar', // "scalar" visualization for a single number
      visualization_settings: {},
      collection_id: collectionId,
    }),
  })

  if (createRes.ok) {
    const questionData = (await createRes.json()) as { id: number }
    return questionData.id
  }
  console.error('❌ Failed to create question:', await createRes.text())
  return null
}
