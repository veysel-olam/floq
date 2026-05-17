import { test, expect } from '@playwright/test'

test.describe('Explore & Search', () => {
  test('explore page loads with search input', async ({ page }) => {
    await page.goto('/explore')
    await expect(page.locator('main input[placeholder*="ara"]')).toBeVisible()
  })

  test('shows Bluesky feed CTA when no query', async ({ page }) => {
    await page.goto('/explore')
    await expect(page.getByText(/bu feed bluesky'da da erişilebilir/i)).toBeVisible()
  })

  test('typing shows search tabs', async ({ page }) => {
    await page.goto('/explore')
    const input = page.locator('main input[placeholder*="ara"]')
    await input.fill('test')
    await expect(page.getByRole('button', { name: /kişiler/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /gönderiler/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /gündem/i })).toBeVisible()
  })

  test('clearing search hides tabs and shows CTA again', async ({ page }) => {
    await page.goto('/explore')
    const input = page.locator('main input[placeholder*="ara"]')
    await input.fill('test')
    await expect(page.getByRole('button', { name: /kişiler/i })).toBeVisible()
    await input.clear()
    await expect(page.getByRole('button', { name: /kişiler/i })).not.toBeVisible()
    await expect(page.getByText(/bu feed bluesky'da da erişilebilir/i)).toBeVisible()
  })

  test('shows public posts or empty state', async ({ page }) => {
    await page.goto('/explore')
    await page.waitForLoadState('networkidle')
    const posts = page.locator('article')
    const count = await posts.count()
    if (count === 0) {
      await expect(page.getByText(/henüz herkese açık gönderi yok/i)).toBeVisible()
    } else {
      await expect(posts.first()).toBeVisible()
    }
  })
})
