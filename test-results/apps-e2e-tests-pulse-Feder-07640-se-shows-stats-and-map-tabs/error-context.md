# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps/e2e/tests/pulse.spec.ts >> Federation Pulse >> shows stats and map tabs
- Location: apps/e2e/tests/pulse.spec.ts:9:7

# Error details

```
Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
Call log:
  - navigating to "/pulse", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test'
  2  | 
  3  | test.describe('Federation Pulse', () => {
  4  |   test('pulse page loads with header', async ({ page }) => {
  5  |     await page.goto('/pulse')
  6  |     await expect(page.getByRole('heading', { name: /federation pulse/i })).toBeVisible()
  7  |   })
  8  | 
  9  |   test('shows stats and map tabs', async ({ page }) => {
> 10 |     await page.goto('/pulse')
     |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  11 |     await expect(page.getByRole('button', { name: /istatistik/i })).toBeVisible()
  12 |     await expect(page.getByRole('button', { name: /harita/i })).toBeVisible()
  13 |   })
  14 | 
  15 |   test('stats tab is active by default', async ({ page }) => {
  16 |     await page.goto('/pulse')
  17 |     await page.waitForLoadState('networkidle')
  18 |     const statsBtn = page.getByRole('button', { name: /istatistik/i })
  19 |     await expect(statsBtn).toBeVisible()
  20 |   })
  21 | 
  22 |   test('map tab switches view', async ({ page }) => {
  23 |     await page.goto('/pulse')
  24 |     await page.getByRole('button', { name: /harita/i }).click()
  25 |     await page.waitForLoadState('networkidle')
  26 |     // Map tab content should be visible
  27 |     await expect(page).toHaveURL(/\/pulse/)
  28 |   })
  29 | 
  30 |   test('sidebar link navigates to pulse', async ({ page }) => {
  31 |     await page.goto('/home')
  32 |     await page.getByRole('link', { name: /pulse/i }).click()
  33 |     await page.waitForURL('**/pulse')
  34 |     await expect(page).toHaveURL(/\/pulse/)
  35 |   })
  36 | })
  37 | 
```