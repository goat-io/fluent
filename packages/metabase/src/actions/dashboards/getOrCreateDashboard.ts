import { metabaseFetch } from '../../common/fetch-wrapper'

export async function getOrCreateDashboard({
  sessionToken,
  collectionId,
  databaseId,
  baseUrl,
  apiKey,
  questionIds,
}: {
  baseUrl: string
  sessionToken?: string
  apiKey?: string
  collectionId: string
  databaseId: string
  questionIds: {
    accounts: number
    posts: number
    privateMessages: number
    comments: number
    createdAccounts: number
    avgUserCreationDay: number
    accumulatedAccounts: number
  }
}) {

  const dashboardsRes = await metabaseFetch({
    baseUrl,
    sessionToken,
    apiKey,
    endpoint: '/api/dashboard',
    method: 'GET',
  })

  if (!dashboardsRes.ok) {
    console.error('❌ Failed to fetch dashboards:', await dashboardsRes.text())
    return
  }

  const dashboards = await dashboardsRes.json() as Array<{ id: number; name: string }>

  let dashboardId
  const existingDashboard = dashboards.find(
    (d) => d.name === 'Sodium - Dashboard',
  )

  if (existingDashboard) {
    dashboardId = existingDashboard.id
  } else {

    // Create new dashboard
    const createRes = await metabaseFetch({
      baseUrl,
      sessionToken,
      apiKey,
      endpoint: '/api/dashboard',
      method: 'POST',
      body: JSON.stringify({
        name: 'Sodium - Dashboard',
        collection_id: collectionId,
      }),
    })

    if (!createRes.ok) {
      console.error('❌ Failed to create dashboard:', await createRes.text())
      return null
    }

    const dashboardData = await createRes.json() as { id: number }
    dashboardId = dashboardData.id
  }

  // Define the layout for the dashboard cards
  const layout = [
    // Top metrics (full width, 4 items)
    {
      id: 100,
      card_id: questionIds.accounts,
      row: 0,
      col: 0,
      size_x: 6,
      size_y: 3,
      dashboard_tab_id: 1,
    },
    {
      id: 101,
      card_id: questionIds.posts,
      row: 0,
      col: 6,
      size_x: 6,
      size_y: 3,
      dashboard_tab_id: 1,
    },
    {
      id: 102,
      card_id: questionIds.privateMessages,
      row: 0,
      col: 12,
      size_x: 6,
      size_y: 3,
      dashboard_tab_id: 1,
    },
    {
      id: 103,
      card_id: questionIds.comments,
      row: 0,
      col: 18,
      size_x: 6,
      size_y: 3,
      dashboard_tab_id: 1,
    },

    // Created Accounts This Month (left side, half width)
    {
      id: 200,
      card_id: questionIds.createdAccounts,
      row: 2,
      col: 0,
      size_x: 12,
      size_y: 4,
      dashboard_tab_id: 1,
    },

    // AVG user creation month
    {
      id: 201,
      card_id: questionIds.avgUserCreationDay,
      row: 2,
      col: 13,
      size_x: 12,
      size_y: 4,
      dashboard_tab_id: 1,
    },

    // Accumulated Accounts (right side, half width)
    {
      id: 300,
      card_id: questionIds.accumulatedAccounts,
      row: 3,
      col: 0,
      size_x: 24,
      size_y: 8,
      dashboard_tab_id: 1,
    },
  ]

  // Update the dashboard with the defined layout
  const updateRes = await metabaseFetch({
    baseUrl,
    sessionToken,
    apiKey,
    endpoint: `/api/dashboard/${dashboardId}`,
    method: 'PUT',
    body: JSON.stringify({
      name: 'Sodium - Dashboard',
      dashcards: layout,
      width: 'full',
      tabs: [
        {
          id: 1,
          name: 'User Acquisition',
        },
      ],
    }),
  })

  if (updateRes.ok) {
  } else {
    console.error('❌ Failed to update dashboard:', await updateRes.text())
  }

  return dashboardId
}
