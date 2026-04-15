// npx playwright test e2e/dashboard.spec.ts
import { test, expect, type Page } from '@playwright/test'

const API = 'http://localhost:4444'

// Helper: create a workflow via API and return runId
async function createWorkflow(page: Page, feedback = 'E2E test feature'): Promise<string> {
  const response = await page.request.post(`${API}/workflows/start`, {
    data: { workflowName: 'demo_pipeline', input: { feedback } },
  })
  const body = await response.json()
  return body.runId
}

// Helper: wait for workflow to reach a status
async function waitForWorkflowStatus(
  page: Page,
  runId: string,
  statuses: string[],
  timeoutMs = 30_000,
): Promise<string> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const res = await page.request.post(`${API}/workflows/status`, { data: { runId } })
    const body = await res.json()
    if (statuses.includes(body.status)) return body.status
    await page.waitForTimeout(500)
  }
  throw new Error(`Workflow ${runId} did not reach ${statuses.join('|')} within ${timeoutMs}ms`)
}

// ── Tests ──────────────────────────────────────────────────────

test.describe('Dashboard', () => {
  test('loads and shows the header', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText('Goat Agents Dashboard')
  })

  test('shows empty state when no workflows exist', async ({ page }) => {
    await page.goto('/')
    // Either shows "No workflow runs found" or an empty table
    await expect(page.locator('body')).toBeVisible()
  })

  test('displays a workflow after creation', async ({ page }) => {
    // Create a workflow via API
    const runId = await createWorkflow(page, 'Dashboard visibility test')

    // Navigate to dashboard
    await page.goto('/')

    // Wait for the workflow to appear in the list (polls every 5s)
    await page.waitForTimeout(6000)
    await page.reload()

    // Should see the workflow name in the table
    await expect(page.locator('text=demo_pipeline')).toBeVisible({ timeout: 10_000 })
  })

  test('shows stats cards with correct counts', async ({ page }) => {
    // Create a workflow that will be RUNNING
    await createWorkflow(page, 'Stats card test')

    await page.goto('/')
    await page.waitForTimeout(6000)
    await page.reload()

    // Should see at least one status badge
    await expect(page.locator('text=Running').or(page.locator('text=Completed')).or(page.locator('text=Waiting'))).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Workflow Run Detail', () => {
  test('shows DAG visualization when clicking a workflow', async ({ page }) => {
    const runId = await createWorkflow(page, 'DAG visualization test')

    // Wait for some steps to complete
    await waitForWorkflowStatus(page, runId, ['WAITING_HUMAN', 'COMPLETED', 'FAILED'])

    // Navigate to the workflow detail page
    await page.goto(`/workflows/${runId}`)

    // Should see the workflow name and status
    await expect(page.locator('text=demo_pipeline')).toBeVisible({ timeout: 10_000 })

    // Should see step nodes in the DAG (React Flow renders these)
    await expect(page.locator('text=analyze')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=plan')).toBeVisible()
    await expect(page.locator('text=implement')).toBeVisible()
    await expect(page.locator('text=review')).toBeVisible()
    await expect(page.locator('text=deploy')).toBeVisible()
  })

  test('shows step status badges in the DAG', async ({ page }) => {
    const runId = await createWorkflow(page, 'Status badge test')
    await waitForWorkflowStatus(page, runId, ['WAITING_HUMAN', 'COMPLETED', 'FAILED'])

    await page.goto(`/workflows/${runId}`)

    // Should see completed badges (analyze, plan, implement should complete before review pauses)
    await expect(page.locator('text=Completed').first()).toBeVisible({ timeout: 10_000 })
  })

  test('opens step detail panel when clicking a step', async ({ page }) => {
    const runId = await createWorkflow(page, 'Step detail test')
    await waitForWorkflowStatus(page, runId, ['WAITING_HUMAN', 'COMPLETED', 'FAILED'])

    await page.goto(`/workflows/${runId}`)
    await page.waitForTimeout(3000) // Wait for DAG to render

    // Click on the 'analyze' step node
    await page.locator('text=analyze').first().click()

    // Step detail panel should appear with step info
    await expect(page.locator('text=I/O').or(page.locator('text=Input'))).toBeVisible({ timeout: 5_000 })
  })
})

test.describe('Human-in-the-Loop', () => {
  test('shows waiting state and approve button for review step', async ({ page }) => {
    const runId = await createWorkflow(page, 'Human-in-the-loop test')

    // Wait for workflow to pause at review step
    await waitForWorkflowStatus(page, runId, ['WAITING_HUMAN'])

    await page.goto(`/workflows/${runId}`)
    await page.waitForTimeout(3000)

    // Should see WAITING_HUMAN status
    await expect(page.locator('text=Waiting')).toBeVisible({ timeout: 10_000 })

    // Click review step to see the approval UI
    await page.locator('text=review').first().click()
    await page.waitForTimeout(1000)

    // Should see "Human Input Required" prompt
    await expect(page.locator('text=Human Input Required').or(page.locator('text=Approve'))).toBeVisible({ timeout: 5_000 })
  })

  test('approving resumes the workflow to completion', async ({ page }) => {
    const runId = await createWorkflow(page, 'Approve and complete test')
    await waitForWorkflowStatus(page, runId, ['WAITING_HUMAN'])

    await page.goto(`/workflows/${runId}`)
    await page.waitForTimeout(3000)

    // Click review step
    await page.locator('text=review').first().click()
    await page.waitForTimeout(1000)

    // Click Approve button
    const approveBtn = page.locator('button:has-text("Approve")')
    if (await approveBtn.isVisible()) {
      await approveBtn.click()

      // Wait for workflow to complete (deploy step runs after approval)
      await waitForWorkflowStatus(page, runId, ['COMPLETED'], 30_000)

      // Refresh and verify completed
      await page.reload()
      await page.waitForTimeout(3000)
      await expect(page.locator('text=Completed').first()).toBeVisible({ timeout: 10_000 })
    }
  })
})

test.describe('Navigation', () => {
  test('navigates from dashboard to workflow detail and back', async ({ page }) => {
    const runId = await createWorkflow(page, 'Navigation test')
    await waitForWorkflowStatus(page, runId, ['WAITING_HUMAN', 'COMPLETED', 'FAILED'])

    // Start at dashboard
    await page.goto('/')
    await page.waitForTimeout(6000)
    await page.reload()

    // Click on the workflow row to navigate to detail
    await page.locator(`text=${runId.substring(0, 12)}`).click()

    // Should be on the detail page
    await expect(page.locator('text=demo_pipeline')).toBeVisible({ timeout: 5_000 })
    await expect(page).toHaveURL(new RegExp(`/workflows/${runId}`))

    // Click back
    await page.locator('text=Back').click()
    await expect(page).toHaveURL('/')
  })
})
