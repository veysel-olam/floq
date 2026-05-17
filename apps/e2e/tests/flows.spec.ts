import { test, expect } from '@playwright/test'

test.describe('Flows', () => {
  test('flows page loads with header', async ({ page }) => {
    await page.goto('/flows')
    await expect(page.getByRole('heading', { name: /akışlar/i })).toBeVisible()
  })

  test('search input is visible', async ({ page }) => {
    await page.goto('/flows')
    await expect(page.locator('main input[placeholder*="ara"]')).toBeVisible()
  })

  test('create flow button is visible', async ({ page }) => {
    await page.goto('/flows')
    await expect(page.getByText(/yeni akış/i)).toBeVisible()
  })

  test('sidebar link navigates to flows', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('link', { name: /akışlar/i }).click()
    await page.waitForURL('**/flows')
    await expect(page).toHaveURL(/\/flows/)
  })

  test('shows flows or empty state', async ({ page }) => {
    await page.goto('/flows')
    await page.waitForLoadState('networkidle')
    const hasFlows = await page.locator('a[href^="/flows/"]').count()
    if (hasFlows === 0) {
      await expect(page.getByText(/henüz akış yok/i)).toBeVisible()
    } else {
      await expect(page.locator('a[href^="/flows/"]').first()).toBeVisible()
    }
  })

  test('can type in search box', async ({ page }) => {
    await page.goto('/flows')
    const searchInput = page.locator('main input[placeholder*="ara"]')
    await searchInput.fill('teknoloji')
    await expect(searchInput).toHaveValue('teknoloji')
  })
})
