# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps/e2e/tests/dm.spec.ts >> Direct Messages >> sidebar link navigates to DMs
- Location: apps/e2e/tests/dm.spec.ts:9:7

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
  3  | test.describe('Direct Messages', () => {
  4  |   test('DM list page loads', async ({ page }) => {
  5  |     await page.goto('/dm')
  6  |     await expect(page.getByRole('heading', { name: /mesajlar/i })).toBeVisible()
  7  |   })
  8  | 
  9  |   test('sidebar link navigates to DMs', async ({ page }) => {
> 10 |     await page.goto('/home')
     |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  11 |     await page.getByRole('link', { name: /mesajlar/i }).click()
  12 |     await page.waitForURL('**/dm')
  13 |     await expect(page).toHaveURL(/\/dm/)
  14 |   })
  15 | 
  16 |   test('empty state shown when no conversations', async ({ page }) => {
  17 |     await page.goto('/dm')
  18 |     // Either shows conversations or empty state
  19 |     const hasConversations = await page.locator('[href^="/dm/"]').count()
  20 |     if (hasConversations === 0) {
  21 |       await expect(page.getByText(/henüz|mesaj yok|konuşma/i)).toBeVisible()
  22 |     }
  23 |   })
  24 | })
  25 | 
```