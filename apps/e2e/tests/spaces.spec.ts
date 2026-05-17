import { test, expect } from '@playwright/test'

test.describe('Spaces', () => {
  test('spaces page loads with header', async ({ page }) => {
    await page.goto('/spaces')
    await expect(page.getByRole('heading', { name: /spaces/i })).toBeVisible()
  })

  test('new space button is visible', async ({ page }) => {
    await page.goto('/spaces')
    await expect(page.getByRole('button', { name: /yeni space/i })).toBeVisible()
  })

  test('shows spaces or empty state', async ({ page }) => {
    await page.goto('/spaces')
    await page.waitForLoadState('networkidle')
    const hasSpaces = await page.locator('a[href^="/spaces/"]').count()
    if (hasSpaces === 0) {
      await expect(page.getByText(/canlı space yok/i)).toBeVisible()
    } else {
      await expect(page.locator('a[href^="/spaces/"]').first()).toBeVisible()
    }
  })

  test('new space form toggles on button click', async ({ page }) => {
    await page.goto('/spaces')
    await page.getByRole('button', { name: /yeni space/i }).click()
    await expect(page.getByPlaceholder('Space başlığı')).toBeVisible()
    await expect(page.getByRole('button', { name: /[iİ]ptal/i })).toBeVisible()
  })
})
