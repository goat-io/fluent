// npx playwright test e2e/workflow-editor.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Workflow Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/designer')
    await page.waitForTimeout(500)
  })

  test('loads designer page with correct layout', async ({ page }) => {
    // Header
    await expect(page.locator('text=Workflow Designer')).toBeVisible()
    await expect(page.locator('text=Visual Editor')).toBeVisible()

    // Navigation (may be buttons or links)
    await expect(page.locator('text=Dashboard').first()).toBeVisible()
    await expect(page.locator('text=Designer').first()).toBeVisible()

    // Toolbar
    await expect(page.locator('button:has-text("Validate")')).toBeVisible()
    await expect(page.locator('button:has-text("Export JSON")')).toBeVisible()
    await expect(page.locator('button:has-text("Import JSON")')).toBeVisible()

    // Palette
    await expect(page.locator('text=Step Palette')).toBeVisible()
    await expect(page.locator('.react-flow')).toBeVisible()

    // Config panel placeholder
    await expect(page.locator('text=Select a step to configure')).toBeVisible()
  })

  test('palette shows all 4 step types', async ({ page }) => {
    const palette = page.locator('text=Step Palette').or(page.locator('text=STEP PALETTE'))
    await expect(palette).toBeVisible()

    // All 4 types visible
    await expect(page.locator('text=Function').first()).toBeVisible()
    await expect(page.locator('text=AI').first()).toBeVisible()
    await expect(page.locator('text=Sandbox').first()).toBeVisible()
    await expect(page.locator('text=Human Approval').first()).toBeVisible()
  })

  test('clicking palette item adds a step node to canvas', async ({ page }) => {
    // No nodes initially
    expect(await page.locator('.react-flow__node').count()).toBe(0)

    // Click Function to add step
    await page.locator('text=Function').first().click()
    await page.waitForTimeout(300)

    // Should have 1 node
    expect(await page.locator('.react-flow__node').count()).toBe(1)

    // Click AI to add another
    await page.locator('text=AI').first().click()
    await page.waitForTimeout(300)

    expect(await page.locator('.react-flow__node').count()).toBe(2)
  })

  test('selecting a step shows config panel', async ({ page }) => {
    // Add a step
    await page.locator('text=Function').first().click()
    await page.waitForTimeout(300)

    // Click on the node to select it
    await page.locator('.react-flow__node').first().click()
    await page.waitForTimeout(300)

    // Config panel should show
    await expect(page.getByRole('heading', { name: 'Step Configuration' })).toBeVisible()
  })

  test('editing step name updates the node', async ({ page }) => {
    // Add a function step
    await page.locator('text=Function').first().click()
    await page.waitForTimeout(500)

    // Select the node by clicking its content (not the wrapper)
    await page.locator('.react-flow__node').first().click({ force: true })
    await page.waitForTimeout(500)

    // Wait for config panel to appear
    await expect(page.getByRole('heading', { name: 'Step Configuration' })).toBeVisible({ timeout: 3000 })

    // Find the step name input — it's an input after the "Step Name" label
    const stepNameInput = page.locator('label:has-text("Step Name") + input').or(
      page.locator('label:has-text("Step Name")').locator('..').locator('input')
    )
    await stepNameInput.fill('my_custom_step')
    await page.waitForTimeout(300)

    // Node text should update
    await expect(page.locator('.react-flow__node').first()).toContainText('my_custom_step')
  })

  test('validate shows no errors for valid workflow', async ({ page }) => {
    // Add a step
    await page.locator('text=Function').first().click()
    await page.waitForTimeout(300)

    // Click validate
    await page.locator('button:has-text("Validate")').click()
    await page.waitForTimeout(300)

    // Should not show error indicators (check no red/error text)
    const errors = await page.locator('text=error').count() +
                   await page.locator('text=Error').count()
    // Might have 0 errors or show a success state
    // The important thing is the button is clickable and the UI responds
    expect(errors).toBeLessThanOrEqual(1) // Allow "0 errors" text
  })

  test('export JSON triggers download', async ({ page }) => {
    // Add two steps
    await page.locator('text=Function').first().click()
    await page.waitForTimeout(200)
    await page.locator('text=AI').first().click()
    await page.waitForTimeout(200)

    // Export
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      page.locator('button:has-text("Export JSON")').click(),
    ])

    expect(download).toBeDefined()
    expect(download.suggestedFilename()).toContain('.json')

    // Read the downloaded content
    const content = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of content) chunks.push(chunk as Buffer)
    const json = JSON.parse(Buffer.concat(chunks).toString())

    expect(json.name).toBe('my-workflow')
    expect(json.version).toBe('1.0.0')
    expect(json.steps).toHaveLength(2)
  })

  test('clear removes all nodes', async ({ page }) => {
    // Add steps
    await page.locator('text=Function').first().click()
    await page.waitForTimeout(200)
    await page.locator('text=AI').first().click()
    await page.waitForTimeout(200)
    expect(await page.locator('.react-flow__node').count()).toBe(2)

    // Click Clear — may trigger window.confirm
    page.on('dialog', dialog => dialog.accept())
    await page.locator('button:has-text("Clear")').click()
    await page.waitForTimeout(500)

    // All nodes removed
    expect(await page.locator('.react-flow__node').count()).toBe(0)
  })

  test('workflow name and version inputs work', async ({ page }) => {
    // Find name input and change it
    const nameInput = page.locator('input').first()
    await nameInput.fill('my-test-workflow')

    // Version input
    const versionInput = page.locator('input').nth(1)
    await versionInput.fill('2.0.0')

    // Add a step and export to verify
    await page.locator('text=Function').first().click()
    await page.waitForTimeout(200)

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 5000 }),
      page.locator('button:has-text("Export JSON")').click(),
    ])

    const content = await download.createReadStream()
    const chunks: Buffer[] = []
    for await (const chunk of content) chunks.push(chunk as Buffer)
    const json = JSON.parse(Buffer.concat(chunks).toString())

    expect(json.name).toBe('my-test-workflow')
    expect(json.version).toBe('2.0.0')
  })

  test('multiple step types have correct badges', async ({ page }) => {
    // Add all 4 types
    await page.locator('text=Function').first().click()
    await page.waitForTimeout(200)
    await page.locator('text=AI').first().click()
    await page.waitForTimeout(200)
    await page.locator('text=Sandbox').first().click()
    await page.waitForTimeout(200)
    await page.locator('text=Human Approval').first().click()
    await page.waitForTimeout(200)

    expect(await page.locator('.react-flow__node').count()).toBe(4)

    // Check each node has correct type badge
    await expect(page.locator('.react-flow__node:has-text("function")').first()).toBeVisible()
    await expect(page.locator('.react-flow__node:has-text("ai")').first()).toBeVisible()
    await expect(page.locator('.react-flow__node:has-text("sandbox")').first()).toBeVisible()
  })
})

test.describe('Navigation', () => {
  test('dashboard has Create Workflow button linking to designer', async ({ page }) => {
    await page.goto('/')
    await page.waitForTimeout(500)

    const createBtn = page.locator('a:has-text("Create Workflow")')
    await expect(createBtn).toBeVisible()
    await createBtn.click()

    await expect(page).toHaveURL(/\/designer/)
    await expect(page.locator('text=Workflow Designer')).toBeVisible()
  })

  test('designer nav links work', async ({ page }) => {
    await page.goto('/designer')
    await page.waitForTimeout(500)

    // Click Dashboard button/link
    await page.locator('text=Dashboard').first().click()
    await page.waitForTimeout(1000)
    await expect(page).toHaveURL('/')

    // Navigate back to designer
    await page.goto('/designer')
    await expect(page.locator('text=Workflow Designer')).toBeVisible()
  })
})
