import { test, expect } from '@playwright/test'

test.describe('Home feed', () => {
  test('shows timeline after login', async ({ page }) => {
    await page.goto('/home')
    await expect(page.locator('header')).toBeVisible()
    // Sidebar nav items
    await expect(page.getByRole('link', { name: /keşfet/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /bildirimler/i })).toBeVisible()
  })

  test('can compose a post', async ({ page }) => {
    await page.goto('/home')
    const composer = page.locator('textarea[placeholder]').first()
    await expect(composer).toBeVisible()
    await composer.fill('E2E test gönderisi — otomatik test')
    const submitBtn = page.getByRole('button', { name: /paylaş|gönder/i })
    await expect(submitBtn).toBeEnabled()
  })

  test('sidebar navigates to explore', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('link', { name: /keşfet/i }).click()
    await page.waitForURL('**/explore')
    await expect(page.locator('main input[placeholder*="ara"]')).toBeVisible()
  })

  test('sidebar navigates to notifications', async ({ page }) => {
    await page.goto('/home')
    await page.getByRole('link', { name: /bildirimler/i }).click()
    await page.waitForURL('**/notifications')
  })
})
