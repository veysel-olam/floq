# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps/e2e/tests/auth.spec.ts >> Authentication >> register page shows form
- Location: apps/e2e/tests/auth.spec.ts:20:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/register", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | // Override project-level storageState so these tests run unauthenticated
  4  | test.use({ storageState: { cookies: [], origins: [] } })
  5  | 
  6  | test.describe('Authentication', () => {
  7  |   test('landing page loads', async ({ page }) => {
  8  |     await page.goto('/')
  9  |     await expect(page).toHaveTitle(/floq/)
  10 |     await expect(page.getByRole('link', { name: /giriş/i }).first()).toBeVisible()
  11 |   })
  12 | 
  13 |   test('login page shows form', async ({ page }) => {
  14 |     await page.goto('/login')
  15 |     await expect(page.getByLabel('E-posta')).toBeVisible()
  16 |     await expect(page.getByLabel('Şifre')).toBeVisible()
  17 |     await expect(page.getByRole('button', { name: 'Giriş yap' })).toBeVisible()
  18 |   })
  19 | 
  20 |   test('register page shows form', async ({ page }) => {
> 21 |     await page.goto('/register')
     |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  22 |     await expect(page.getByLabel('İsim')).toBeVisible()
  23 |     await expect(page.getByLabel('Kullanıcı adı')).toBeVisible()
  24 |     await expect(page.getByLabel('E-posta')).toBeVisible()
  25 |   })
  26 | 
  27 |   test('invalid login shows error', async ({ page }) => {
  28 |     await page.goto('/login')
  29 |     await page.getByLabel('E-posta').fill('wrong@example.com')
  30 |     await page.getByLabel('Şifre').fill('wrongpassword')
  31 |     await page.getByRole('button', { name: 'Giriş yap' }).click()
  32 |     await expect(page.locator('text=/hatalı|geçersiz|başarısız/i')).toBeVisible({ timeout: 5000 })
  33 |   })
  34 | 
  35 |   test('unauthenticated /home redirects to /login', async ({ page }) => {
  36 |     await page.goto('/home')
  37 |     await page.waitForURL('**/login')
  38 |     expect(page.url()).toContain('/login')
  39 |   })
  40 | })
  41 | 
```