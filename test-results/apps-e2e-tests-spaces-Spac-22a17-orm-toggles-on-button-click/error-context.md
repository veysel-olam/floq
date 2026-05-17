# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps/e2e/tests/spaces.spec.ts >> Spaces >> new space form toggles on button click
- Location: apps/e2e/tests/spaces.spec.ts:25:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/spaces", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test.describe('Spaces', () => {
  4  |   test('spaces page loads with header', async ({ page }) => {
  5  |     await page.goto('/spaces')
  6  |     await expect(page.getByRole('heading', { name: /spaces/i })).toBeVisible()
  7  |   })
  8  | 
  9  |   test('new space button is visible', async ({ page }) => {
  10 |     await page.goto('/spaces')
  11 |     await expect(page.getByRole('button', { name: /yeni space/i })).toBeVisible()
  12 |   })
  13 | 
  14 |   test('shows spaces or empty state', async ({ page }) => {
  15 |     await page.goto('/spaces')
  16 |     await page.waitForLoadState('networkidle')
  17 |     const hasSpaces = await page.locator('a[href^="/spaces/"]').count()
  18 |     if (hasSpaces === 0) {
  19 |       await expect(page.getByText(/canlı space yok/i)).toBeVisible()
  20 |     } else {
  21 |       await expect(page.locator('a[href^="/spaces/"]').first()).toBeVisible()
  22 |     }
  23 |   })
  24 | 
  25 |   test('new space form toggles on button click', async ({ page }) => {
> 26 |     await page.goto('/spaces')
     |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  27 |     await page.getByRole('button', { name: /yeni space/i }).click()
  28 |     await expect(page.getByPlaceholder('Space başlığı')).toBeVisible()
  29 |     await expect(page.getByRole('button', { name: /iptal/i })).toBeVisible()
  30 |   })
  31 | })
  32 | 
```