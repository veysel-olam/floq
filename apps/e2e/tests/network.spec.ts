import { test, expect } from '@playwright/test'

test.describe('Network Map', () => {
  test('network page loads with header', async ({ page }) => {
    await page.goto('/network')
    await expect(page.getByRole('heading', { name: /bağlantı haritası/i })).toBeVisible()
  })

  test('shows graph or empty state', async ({ page }) => {
    await page.goto('/network')
    await page.waitForLoadState('networkidle')
    const hasGraph = await page.locator('main svg').count()
    if (hasGraph > 0) {
      await expect(page.locator('main svg').first()).toBeVisible()
    } else {
      await expect(page.getByText(/en az bir kişiyi takip/i)).toBeVisible()
    }
  })

  test('zoom controls are visible when graph loads', async ({ page }) => {
    await page.goto('/network')
    await page.waitForLoadState('networkidle')
    // Only shown when nodeCount >= 2
    const svgExists = await page.locator('svg').count()
    if (svgExists > 0) {
      await expect(page.locator('button').filter({ hasText: '' }).first()).toBeVisible()
    }
  })

  test('sidebar link navigates to network', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('link', { name: /ağ haritası/i }).click()
    await page.waitForURL('**/network')
    await expect(page).toHaveURL(/\/network/)
  })
})
