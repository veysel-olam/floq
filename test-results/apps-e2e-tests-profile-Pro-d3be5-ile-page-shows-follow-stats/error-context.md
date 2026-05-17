# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: apps/e2e/tests/profile.spec.ts >> Profile >> profile page shows follow stats
- Location: apps/e2e/tests/profile.spec.ts:11:7

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
  3  | test.describe('Profile', () => {
  4  |   test('profile link in sidebar navigates to own profile', async ({ page }) => {
  5  |     await page.goto('/home')
  6  |     await page.getByRole('link', { name: /profil/i }).click()
  7  |     await expect(page).toHaveURL(/\/[a-z0-9_]+$/)
  8  |     await expect(page.locator('header')).toBeVisible()
  9  |   })
  10 | 
  11 |   test('profile page shows follow stats', async ({ page }) => {
> 12 |     await page.goto('/home')
     |                ^ Error: page.goto: Protocol error (Page.navigate): Cannot navigate to invalid URL
  13 |     await page.getByRole('link', { name: /profil/i }).click()
  14 |     await expect(page.getByText(/takipçi/i).first()).toBeVisible()
  15 |     await expect(page.getByText(/takip/i).first()).toBeVisible()
  16 |   })
  17 | 
  18 |   test('post thread page loads', async ({ page }) => {
  19 |     // Navigate home, click first post if available
  20 |     await page.goto('/home')
  21 |     const firstPostLink = page.locator('a[href^="/posts/"]').first()
  22 |     const count = await firstPostLink.count()
  23 |     if (count > 0) {
  24 |       await firstPostLink.click()
  25 |       await expect(page).toHaveURL(/\/posts\//)
  26 |     }
  27 |   })
  28 | 
  29 |   test('notifications page loads', async ({ page }) => {
  30 |     await page.goto('/notifications')
  31 |     await expect(page.getByRole('heading', { name: /bildirimler/i })).toBeVisible()
  32 |   })
  33 | })
  34 | 
```