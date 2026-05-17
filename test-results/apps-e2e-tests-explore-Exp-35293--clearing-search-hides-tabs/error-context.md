# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps/e2e/tests/explore.spec.ts >> Explore & Search >> clearing search hides tabs
- Location: apps/e2e/tests/explore.spec.ts:17:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/explore", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test.describe('Explore & Search', () => {
  4  |   test('search input is visible', async ({ page }) => {
  5  |     await page.goto('/explore')
  6  |     await expect(page.locator('main input[placeholder*="ara"]')).toBeVisible()
  7  |   })
  8  | 
  9  |   test('typing shows tabs', async ({ page }) => {
  10 |     await page.goto('/explore')
  11 |     const input = page.locator('main input[placeholder*="ara"]')
  12 |     await input.fill('test')
  13 |     await expect(page.getByRole('button', { name: /kişiler/i })).toBeVisible()
  14 |     await expect(page.getByRole('button', { name: /gönderiler/i })).toBeVisible()
  15 |   })
  16 | 
  17 |   test('clearing search hides tabs', async ({ page }) => {
> 18 |     await page.goto('/explore')
     |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  19 |     const input = page.locator('main input[placeholder*="ara"]')
  20 |     await input.fill('test')
  21 |     await input.clear()
  22 |     await expect(page.getByRole('button', { name: /kişiler/i })).not.toBeVisible()
  23 |   })
  24 | })
  25 | 
```