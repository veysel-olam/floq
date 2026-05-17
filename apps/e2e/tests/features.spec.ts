import { test, expect } from '@playwright/test'

test.describe('Bookmarks', () => {
  test('bookmarks page loads', async ({ page }) => {
    await page.goto('/bookmarks')
    await expect(page.getByRole('heading', { name: /kaydedilenler/i })).toBeVisible()
  })

  test('shows bookmarks or empty state', async ({ page }) => {
    await page.goto('/bookmarks')
    await page.waitForLoadState('networkidle')
    const count = await page.locator('article').count()
    if (count === 0) {
      await expect(page.getByText(/henüz kaydettiğin gönderi yok/i)).toBeVisible()
    }
  })
})

test.describe('Lists', () => {
  test('lists page loads', async ({ page }) => {
    await page.goto('/lists')
    await expect(page.getByRole('heading', { name: /listelerim/i })).toBeVisible()
  })

  test('create list button is visible', async ({ page }) => {
    await page.goto('/lists')
    await expect(page.getByRole('button', { name: /yeni liste/i })).toBeVisible()
  })
})

test.describe('Interview Mode', () => {
  test('interview page loads', async ({ page }) => {
    await page.goto('/interview')
    await expect(page.getByRole('heading', { name: /röportaj/i })).toBeVisible()
  })
})
