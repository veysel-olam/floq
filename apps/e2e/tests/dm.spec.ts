import { test, expect } from '@playwright/test'

test.describe('Direct Messages', () => {
  test('DM list page loads', async ({ page }) => {
    await page.goto('/dm')
    await expect(page.getByRole('heading', { name: /mesajlar/i })).toBeVisible()
  })

  test('sidebar link navigates to DMs', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('link', { name: /mesajlar/i }).click()
    await page.waitForURL('**/dm')
    await expect(page).toHaveURL(/\/dm/)
  })

  test('empty state shown when no conversations', async ({ page }) => {
    await page.goto('/dm')
    // Either shows conversations or empty state
    const hasConversations = await page.locator('[href^="/dm/"]').count()
    if (hasConversations === 0) {
      await expect(page.getByText(/henüz|mesaj yok|konuşma/i)).toBeVisible()
    }
  })
})
