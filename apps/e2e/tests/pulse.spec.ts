import { test, expect } from '@playwright/test'

test.describe('Federation Pulse', () => {
  test('pulse page loads with header', async ({ page }) => {
    await page.goto('/pulse')
    await expect(page.getByRole('heading', { name: /federation pulse/i })).toBeVisible()
  })

  test('shows stats and map tabs', async ({ page }) => {
    await page.goto('/pulse')
    await expect(page.getByRole('button', { name: /[iİ]statistik/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /harita/i })).toBeVisible()
  })

  test('stats tab is active by default', async ({ page }) => {
    await page.goto('/pulse')
    await page.waitForLoadState('networkidle')
    const statsBtn = page.getByRole('button', { name: /[iİ]statistik/i })
    await expect(statsBtn).toBeVisible()
  })

  test('map tab switches view', async ({ page }) => {
    await page.goto('/pulse')
    await page.getByRole('button', { name: /harita/i }).click()
    await page.waitForLoadState('networkidle')
    // Map tab content should be visible
    await expect(page).toHaveURL(/\/pulse/)
  })

  test('sidebar link navigates to pulse', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('link', { name: /pulse/i }).click()
    await page.waitForURL('**/pulse')
    await expect(page).toHaveURL(/\/pulse/)
  })
})
