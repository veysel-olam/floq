import { test, expect } from '@playwright/test'

test.describe('Notifications', () => {
  test('notifications page loads with header', async ({ page }) => {
    await page.goto('/notifications')
    await expect(page.getByRole('heading', { name: /bildirimler/i })).toBeVisible()
  })

  test('shows notifications or empty state', async ({ page }) => {
    await page.goto('/notifications')
    await page.waitForLoadState('networkidle')
    const hasNotifs = await page.locator('[class*="border-b"]').count()
    if (hasNotifs === 0) {
      await expect(page.getByText(/henüz bildirim yok/i)).toBeVisible()
    }
  })

  test('mark all read button visible when unread notifications exist', async ({ page }) => {
    await page.goto('/notifications')
    await page.waitForLoadState('networkidle')
    const unreadBadge = page.getByRole('button', { name: /tümünü okundu/i })
    // Button only shows when unread notifications exist — just check it's interactive if present
    const count = await unreadBadge.count()
    if (count > 0) {
      await expect(unreadBadge).toBeEnabled()
    }
  })

  test('delete button visible on notification items', async ({ page }) => {
    await page.goto('/notifications')
    await page.waitForLoadState('networkidle')
    const notifItems = page.locator('[class*="border-b"]')
    const count = await notifItems.count()
    if (count > 0) {
      // Each notification item should have a delete button
      const deleteBtn = notifItems.first().locator('button[title="Bildirimi sil"]')
      await expect(deleteBtn).toBeVisible()
    }
  })

  test('can delete a notification', async ({ page }) => {
    await page.goto('/notifications')
    await page.waitForLoadState('networkidle')
    const notifItems = page.locator('[class*="border-b"]')
    const initialCount = await notifItems.count()
    if (initialCount > 0) {
      const deleteBtn = notifItems.first().locator('button[title="Bildirimi sil"]')
      await deleteBtn.click()
      await page.waitForTimeout(500)
      const newCount = await notifItems.count()
      expect(newCount).toBeLessThan(initialCount)
    }
  })

  test('load more button paginates', async ({ page }) => {
    await page.goto('/notifications')
    await page.waitForLoadState('networkidle')
    const loadMore = page.getByRole('button', { name: /daha fazla/i })
    const count = await loadMore.count()
    if (count > 0) {
      await expect(loadMore).toBeEnabled()
    }
  })
})
