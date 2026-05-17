# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps/e2e/tests/settings.spec.ts >> Settings >> sessions tab lists active session
- Location: apps/e2e/tests/settings.spec.ts:27:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/settings", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test.describe('Settings', () => {
  4  |   test('settings page loads and shows tabs', async ({ page }) => {
  5  |     await page.goto('/settings')
  6  |     await expect(page.getByRole('heading', { name: /ayarlar/i })).toBeVisible()
  7  |     await expect(page.getByRole('button', { name: /profil/i })).toBeVisible()
  8  |     await expect(page.getByRole('button', { name: /gizlilik/i })).toBeVisible()
  9  |     await expect(page.getByRole('button', { name: /güvenlik/i })).toBeVisible()
  10 |   })
  11 | 
  12 |   test('profile tab shows display name input', async ({ page }) => {
  13 |     await page.goto('/settings')
  14 |     await page.getByRole('button', { name: /profil/i }).click()
  15 |     await expect(page.getByLabel(/görünen ad/i)).toBeVisible()
  16 |     await expect(page.getByLabel(/biyografi/i)).toBeVisible()
  17 |   })
  18 | 
  19 |   test('can type in display name field', async ({ page }) => {
  20 |     await page.goto('/settings')
  21 |     await page.getByRole('button', { name: /profil/i }).click()
  22 |     const nameInput = page.getByLabel(/görünen ad/i)
  23 |     await nameInput.fill('Test Kullanıcı')
  24 |     await expect(page.getByRole('button', { name: /kaydet/i })).toBeEnabled()
  25 |   })
  26 | 
  27 |   test('sessions tab lists active session', async ({ page }) => {
> 28 |     await page.goto('/settings')
     |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  29 |     await page.getByRole('button', { name: /oturumlar/i }).click()
  30 |     await expect(page.getByText(/bu oturum/i)).toBeVisible({ timeout: 5000 })
  31 |   })
  32 | 
  33 |   test('security tab shows password change form', async ({ page }) => {
  34 |     await page.goto('/settings')
  35 |     await page.getByRole('button', { name: /güvenlik/i }).click()
  36 |     await expect(page.getByText(/şifre değiştir/i)).toBeVisible()
  37 |     await expect(page.getByLabel(/mevcut şifre/i)).toBeVisible()
  38 |   })
  39 | 
  40 |   test('account tab shows data export button', async ({ page }) => {
  41 |     await page.goto('/settings')
  42 |     await page.getByRole('button', { name: /hesap/i }).click()
  43 |     await expect(page.getByRole('button', { name: /veri [iİ]ndir/i })).toBeVisible()
  44 |   })
  45 | })
  46 | 
```