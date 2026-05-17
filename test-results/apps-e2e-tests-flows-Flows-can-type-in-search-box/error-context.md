# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps/e2e/tests/flows.spec.ts >> Flows >> can type in search box
- Location: apps/e2e/tests/flows.spec.ts:37:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/flows", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test.describe('Flows', () => {
  4  |   test('flows page loads with header', async ({ page }) => {
  5  |     await page.goto('/flows')
  6  |     await expect(page.getByRole('heading', { name: /akışlar/i })).toBeVisible()
  7  |   })
  8  | 
  9  |   test('search input is visible', async ({ page }) => {
  10 |     await page.goto('/flows')
  11 |     await expect(page.locator('main input[placeholder*="ara"]')).toBeVisible()
  12 |   })
  13 | 
  14 |   test('create flow button is visible', async ({ page }) => {
  15 |     await page.goto('/flows')
  16 |     await expect(page.getByText(/yeni akış/i)).toBeVisible()
  17 |   })
  18 | 
  19 |   test('sidebar link navigates to flows', async ({ page }) => {
  20 |     await page.goto('/home')
  21 |     await page.getByRole('link', { name: /akışlar/i }).click()
  22 |     await page.waitForURL('**/flows')
  23 |     await expect(page).toHaveURL(/\/flows/)
  24 |   })
  25 | 
  26 |   test('shows flows or empty state', async ({ page }) => {
  27 |     await page.goto('/flows')
  28 |     await page.waitForLoadState('networkidle')
  29 |     const hasFlows = await page.locator('a[href^="/flows/"]').count()
  30 |     if (hasFlows === 0) {
  31 |       await expect(page.getByText(/henüz akış yok/i)).toBeVisible()
  32 |     } else {
  33 |       await expect(page.locator('a[href^="/flows/"]').first()).toBeVisible()
  34 |     }
  35 |   })
  36 | 
  37 |   test('can type in search box', async ({ page }) => {
> 38 |     await page.goto('/flows')
     |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  39 |     const searchInput = page.locator('main input[placeholder*="ara"]')
  40 |     await searchInput.fill('teknoloji')
  41 |     await expect(searchInput).toHaveValue('teknoloji')
  42 |   })
  43 | })
  44 | 
```