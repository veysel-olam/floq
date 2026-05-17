import { test, expect } from '@playwright/test'

// Override project-level storageState so these tests run unauthenticated
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Authentication', () => {
  test('landing page loads', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/floq/)
    await expect(page.getByRole('link', { name: /giriş/i }).first()).toBeVisible()
  })

  test('login page shows form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByLabel('E-posta')).toBeVisible()
    await expect(page.getByLabel('Şifre')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Giriş yap' })).toBeVisible()
  })

  test('register page shows form', async ({ page }) => {
    await page.goto('/register')
    await expect(page.getByLabel('İsim')).toBeVisible()
    await expect(page.getByLabel('Kullanıcı adı')).toBeVisible()
    await expect(page.getByLabel('E-posta')).toBeVisible()
  })

  test('invalid login shows error', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-posta').fill('wrong@example.com')
    await page.getByLabel('Şifre').fill('wrongpassword')
    await page.getByRole('button', { name: 'Giriş yap' }).click()
    await expect(page.locator('text=/hatalı|geçersiz|başarısız/i')).toBeVisible({ timeout: 5000 })
  })

  test('unauthenticated /home redirects to /login', async ({ page }) => {
    await page.goto('/home')
    await page.waitForURL('**/login')
    expect(page.url()).toContain('/login')
  })
})
