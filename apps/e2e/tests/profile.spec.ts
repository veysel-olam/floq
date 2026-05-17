import { test, expect } from '@playwright/test'

test.describe('Profile', () => {
  test('profile link in sidebar navigates to own profile', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('link', { name: /profil/i }).click()
    await expect(page).toHaveURL(/\/[a-z0-9_]+$/)
    await expect(page.locator('header')).toBeVisible()
  })

  test('profile page shows follow stats', async ({ page }) => {
    await page.goto('/home')
    // Wait for session to load so the profile link (handle-dependent) is rendered
    const profileLink = page.getByRole('link', { name: /profil/i })
    await expect(profileLink).toBeVisible({ timeout: 10000 })
    const profileHref = await profileLink.getAttribute('href')
    // page.goto avoids client-side nav race condition on mobile
    await page.goto(profileHref!)
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(/takipçi/i).first()).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/takip/i).first()).toBeVisible()
  })

  test('post thread page loads', async ({ page }) => {
    // Navigate home, click first post if available
    await page.goto('/home')
    const firstPostLink = page.locator('a[href^="/posts/"]').first()
    const count = await firstPostLink.count()
    if (count > 0) {
      await firstPostLink.click()
      await expect(page).toHaveURL(/\/posts\//)
    }
  })

  test('notifications page loads', async ({ page }) => {
    await page.goto('/notifications')
    await expect(page.getByRole('heading', { name: /bildirimler/i })).toBeVisible()
  })
})
