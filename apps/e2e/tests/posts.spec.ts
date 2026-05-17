import { test, expect } from '@playwright/test'

test.describe('Post Composer', () => {
  test('compose textarea is visible on home feed', async ({ page }) => {
    await page.goto('/home')
    await expect(page.locator('textarea[placeholder]').first()).toBeVisible()
  })

  test('submit button is enabled when text is entered', async ({ page }) => {
    await page.goto('/home')
    const composer = page.locator('textarea[placeholder]').first()
    await composer.fill('E2E test gönderisi')
    const submit = page.getByRole('button', { name: /paylaş|gönder/i }).first()
    await expect(submit).toBeEnabled()
  })

  test('submit button is disabled when composer is empty', async ({ page }) => {
    await page.goto('/home')
    const composer = page.locator('textarea[placeholder]').first()
    await composer.fill('')
    const submit = page.getByRole('button', { name: /paylaş|gönder/i }).first()
    await expect(submit).toBeDisabled()
  })
})

test.describe('Post Interactions', () => {
  test('post action buttons are visible on feed posts', async ({ page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')
    const posts = page.locator('article[data-post-card]')
    const count = await posts.count()
    if (count === 0) return

    const first = posts.first()
    await expect(first.locator('button[title="Yanıtla"]')).toBeVisible()
    await expect(first.locator('button[title="Yeniden paylaş"]')).toBeVisible()
    await expect(first.locator('button[title="Beğen"]')).toBeVisible()
    await expect(first.locator('button[title="Kaydet"]')).toBeVisible()
  })

  test('clicking reply opens inline reply form', async ({ page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')
    const posts = page.locator('article[data-post-card]')
    if (await posts.count() === 0) return

    await posts.first().locator('button[title="Yanıtla"]').click()
    await expect(page.locator('textarea[placeholder="Yanıtını yaz..."]')).toBeVisible()
    await expect(page.getByRole('button', { name: /^[İi]ptal$/i })).toBeVisible()
  })

  test('cancel button closes reply form', async ({ page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')
    const posts = page.locator('article[data-post-card]')
    if (await posts.count() === 0) return

    await posts.first().locator('button[title="Yanıtla"]').click()
    const replyBox = page.locator('textarea[placeholder="Yanıtını yaz..."]')
    await expect(replyBox).toBeVisible()
    await page.getByRole('button', { name: /^[İi]ptal$/i }).click()
    await expect(replyBox).not.toBeVisible()
  })

  test('reply submit button disabled when textarea is empty', async ({ page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')
    const posts = page.locator('article[data-post-card]')
    if (await posts.count() === 0) return

    await posts.first().locator('button[title="Yanıtla"]').click()
    await expect(page.locator('textarea[placeholder="Yanıtını yaz..."]')).toBeVisible()
    // ActionBtn has title="Yanıtla"; the submit button has text but no title attr
    const submitBtn = page.locator('button:not([title])').filter({ hasText: /^yanıtla$/i })
    await expect(submitBtn).toBeDisabled()
  })

  test('reply submit enabled after typing', async ({ page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')
    const posts = page.locator('article[data-post-card]')
    if (await posts.count() === 0) return

    await posts.first().locator('button[title="Yanıtla"]').click()
    const replyBox = page.locator('textarea[placeholder="Yanıtını yaz..."]')
    await replyBox.fill('E2E yanıt testi')
    const submitBtn = page.locator('button:not([title])').filter({ hasText: /^yanıtla$/i })
    await expect(submitBtn).toBeEnabled()
  })

  test('like button toggles active state optimistically', async ({ page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')
    const posts = page.locator('article[data-post-card]')
    if (await posts.count() === 0) return

    const likeBtn = posts.first().locator('button[title="Beğen"]')
    const classBefore = await likeBtn.getAttribute('class')
    await likeBtn.click()
    await page.waitForTimeout(300)
    const classAfter = await likeBtn.getAttribute('class')
    // Class should change (active color applied or removed)
    expect(classBefore).not.toEqual(classAfter)
  })

  test('boost button toggles active state optimistically', async ({ page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')
    const posts = page.locator('article[data-post-card]')
    if (await posts.count() === 0) return

    const boostBtn = posts.first().locator('button[title="Yeniden paylaş"]')
    const classBefore = await boostBtn.getAttribute('class')
    await boostBtn.click()
    await page.waitForTimeout(300)
    const classAfter = await boostBtn.getAttribute('class')
    expect(classBefore).not.toEqual(classAfter)
  })

  test('bookmark button toggles active state', async ({ page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')
    const posts = page.locator('article[data-post-card]')
    if (await posts.count() === 0) return

    const bookmarkBtn = posts.first().locator('button[title="Kaydet"]')
    const classBefore = await bookmarkBtn.getAttribute('class')
    await bookmarkBtn.click()
    await page.waitForTimeout(300)
    const classAfter = await bookmarkBtn.getAttribute('class')
    expect(classBefore).not.toEqual(classAfter)
  })
})

test.describe('Post Detail Page', () => {
  test('post permalink page loads', async ({ page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')
    const permalink = page.locator('a[href^="/posts/"]').first()
    if (await permalink.count() === 0) return

    const href = await permalink.getAttribute('href')
    await page.goto(href!)
    await expect(page).toHaveURL(/\/posts\//)
    await expect(page.locator('article[data-post-card]').first()).toBeVisible()
  })

  test('post permalink shows reply section', async ({ page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')
    const permalink = page.locator('a[href^="/posts/"]').first()
    if (await permalink.count() === 0) return

    const href = await permalink.getAttribute('href')
    await page.goto(href!)
    await page.waitForLoadState('networkidle')
    // Post detail should have reply action buttons on the main post
    await expect(page.locator('button[title="Yanıtla"]').first()).toBeVisible()
  })
})

test.describe('Own Post Actions', () => {
  test('own posts show edit/delete menu on hover', async ({ page }) => {
    await page.goto('/home')
    await page.waitForLoadState('networkidle')

    // Navigate to own profile to find own posts
    const profileLink = page.getByRole('link', { name: /profil/i })
    if (await profileLink.count() === 0) return
    const href = await profileLink.getAttribute('href')
    await page.goto(href!)
    await page.waitForLoadState('networkidle')

    const ownPosts = page.locator('article[data-post-card]')
    if (await ownPosts.count() === 0) return

    // Hover to reveal the MoreHorizontal button (opacity-0 → group-hover:opacity-100)
    await ownPosts.first().hover()
    // Last button inside the post card is the MoreHorizontal menu trigger
    const menuBtn = ownPosts.first().locator('button').last()
    await menuBtn.click({ force: true })

    await expect(page.getByText(/düzenle/i)).toBeVisible()
    await expect(page.getByText(/sil/i)).toBeVisible()
  })
})
