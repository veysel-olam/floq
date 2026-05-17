# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps/e2e/tests/home.spec.ts >> Home feed >> sidebar navigates to explore
- Location: apps/e2e/tests/home.spec.ts:21:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/home", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test.describe('Home feed', () => {
  4  |   test('shows timeline after login', async ({ page }) => {
  5  |     await page.goto('/home')
  6  |     await expect(page.locator('header')).toBeVisible()
  7  |     // Sidebar nav items
  8  |     await expect(page.getByRole('link', { name: /keşfet/i })).toBeVisible()
  9  |     await expect(page.getByRole('link', { name: /bildirimler/i })).toBeVisible()
  10 |   })
  11 | 
  12 |   test('can compose a post', async ({ page }) => {
  13 |     await page.goto('/home')
  14 |     const composer = page.locator('textarea[placeholder]').first()
  15 |     await expect(composer).toBeVisible()
  16 |     await composer.fill('E2E test gönderisi — otomatik test')
  17 |     const submitBtn = page.getByRole('button', { name: /paylaş|gönder/i })
  18 |     await expect(submitBtn).toBeEnabled()
  19 |   })
  20 | 
  21 |   test('sidebar navigates to explore', async ({ page }) => {
> 22 |     await page.goto('/home')
     |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  23 |     await page.getByRole('link', { name: /keşfet/i }).click()
  24 |     await page.waitForURL('**/explore')
  25 |     await expect(page.locator('main input[placeholder*="ara"]')).toBeVisible()
  26 |   })
  27 | 
  28 |   test('sidebar navigates to notifications', async ({ page }) => {
  29 |     await page.goto('/home')
  30 |     await page.getByRole('link', { name: /bildirimler/i }).click()
  31 |     await page.waitForURL('**/notifications')
  32 |   })
  33 | })
  34 | 
```