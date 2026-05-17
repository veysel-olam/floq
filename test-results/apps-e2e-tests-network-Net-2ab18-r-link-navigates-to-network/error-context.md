# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps/e2e/tests/network.spec.ts >> Network Map >> sidebar link navigates to network
- Location: apps/e2e/tests/network.spec.ts:31:7

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
  3  | test.describe('Network Map', () => {
  4  |   test('network page loads with header', async ({ page }) => {
  5  |     await page.goto('/network')
  6  |     await expect(page.getByRole('heading', { name: /bağlantı haritası/i })).toBeVisible()
  7  |   })
  8  | 
  9  |   test('shows graph or empty state', async ({ page }) => {
  10 |     await page.goto('/network')
  11 |     await page.waitForLoadState('networkidle')
  12 |     const hasGraph = await page.locator('svg').count()
  13 |     if (hasGraph > 0) {
  14 |       // Graph is rendered with SVG
  15 |       await expect(page.locator('svg').first()).toBeVisible()
  16 |     } else {
  17 |       await expect(page.getByText(/en az bir kişiyi takip/i)).toBeVisible()
  18 |     }
  19 |   })
  20 | 
  21 |   test('zoom controls are visible when graph loads', async ({ page }) => {
  22 |     await page.goto('/network')
  23 |     await page.waitForLoadState('networkidle')
  24 |     // Only shown when nodeCount >= 2
  25 |     const svgExists = await page.locator('svg').count()
  26 |     if (svgExists > 0) {
  27 |       await expect(page.locator('button').filter({ hasText: '' }).first()).toBeVisible()
  28 |     }
  29 |   })
  30 | 
  31 |   test('sidebar link navigates to network', async ({ page }) => {
> 32 |     await page.goto('/home')
     |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  33 |     await page.getByRole('link', { name: /ağ haritası/i }).click()
  34 |     await page.waitForURL('**/network')
  35 |     await expect(page).toHaveURL(/\/network/)
  36 |   })
  37 | })
  38 | 
```