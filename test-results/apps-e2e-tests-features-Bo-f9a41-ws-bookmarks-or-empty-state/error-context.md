# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps/e2e/tests/features.spec.ts >> Bookmarks >> shows bookmarks or empty state
- Location: apps/e2e/tests/features.spec.ts:9:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/bookmarks", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test.describe('Bookmarks', () => {
  4  |   test('bookmarks page loads', async ({ page }) => {
  5  |     await page.goto('/bookmarks')
  6  |     await expect(page.getByRole('heading', { name: /kaydedilenler/i })).toBeVisible()
  7  |   })
  8  | 
  9  |   test('shows bookmarks or empty state', async ({ page }) => {
> 10 |     await page.goto('/bookmarks')
     |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  11 |     await page.waitForLoadState('networkidle')
  12 |     const count = await page.locator('article').count()
  13 |     if (count === 0) {
  14 |       await expect(page.getByText(/henüz kaydettiğin gönderi yok/i)).toBeVisible()
  15 |     }
  16 |   })
  17 | })
  18 | 
  19 | test.describe('Lists', () => {
  20 |   test('lists page loads', async ({ page }) => {
  21 |     await page.goto('/lists')
  22 |     await expect(page.getByRole('heading', { name: /listelerim/i })).toBeVisible()
  23 |   })
  24 | 
  25 |   test('create list button is visible', async ({ page }) => {
  26 |     await page.goto('/lists')
  27 |     await expect(page.getByRole('button', { name: /yeni liste/i })).toBeVisible()
  28 |   })
  29 | })
  30 | 
  31 | test.describe('Interview Mode', () => {
  32 |   test('interview page loads', async ({ page }) => {
  33 |     await page.goto('/interview')
  34 |     await expect(page.getByRole('heading', { name: /röportaj/i })).toBeVisible()
  35 |   })
  36 | })
  37 | 
```