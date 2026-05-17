import { test, expect } from '@playwright/test'

test.describe('Settings', () => {
  test('settings page loads with sidebar tabs', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.getByRole('heading', { name: /ayarlar/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /^profil$/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /güvenlik/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /oturumlar/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /görünüm/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /hesap/i })).toBeVisible()
  })

  test('profile tab shows editable fields', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /^profil$/i }).click({ force: true })
    await expect(page.getByLabel(/görünen ad/i)).toBeVisible()
    await expect(page.getByLabel(/biyografi/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /^kaydet$/i })).toBeVisible()
  })

  test('can type in display name field', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /^profil$/i }).click({ force: true })
    const nameInput = page.getByLabel(/görünen ad/i)
    await nameInput.clear()
    await nameInput.fill('Test Kullanıcı')
    await expect(page.getByRole('button', { name: /^kaydet$/i })).toBeEnabled()
  })

  test('profile tab shows Bluesky / AT Protocol section', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /^profil$/i }).click({ force: true })
    await expect(page.getByText(/at protocol.*bluesky/i)).toBeVisible()
    await expect(page.getByText(/did:web/i)).toBeVisible()
  })

  test('moderation tab shows blocks and mutes sections', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /moderasyon/i }).click({ force: true })
    await expect(page.getByText(/engellenenler/i)).toBeVisible()
    await expect(page.getByText(/susturulanlar/i)).toBeVisible()
  })

  test('filters tab shows keyword filter form', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /filtreler/i }).click({ force: true })
    await expect(page.getByText(/anahtar kelime filtreleri/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /ekle/i })).toBeVisible()
  })

  test('feed tab shows preset options', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /^feed$/i }).click({ force: true })
    await expect(page.getByText(/hazır presetler/i)).toBeVisible()
    await expect(page.getByText(/saf kronolojik/i)).toBeVisible()
  })

  test('security tab shows password change form', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /güvenlik/i }).click({ force: true })
    await expect(page.getByText(/şifre değiştir/i)).toBeVisible()
    await expect(page.getByLabel(/mevcut şifre/i)).toBeVisible()
    await expect(page.getByLabel(/yeni şifre/i)).toBeVisible()
  })

  test('security tab shows 2FA setup', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /güvenlik/i }).click({ force: true })
    await expect(page.getByText(/iki faktörlü doğrulama/i)).toBeVisible()
  })

  test('sessions tab lists active session', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /oturumlar/i }).click({ force: true })
    await expect(page.getByText(/bu oturum/i)).toBeVisible({ timeout: 10000 })
  })

  test('appearance tab shows theme options', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /görünüm/i }).click({ force: true })
    await expect(page.getByText(/^tema$/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /açık/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /koyu/i })).toBeVisible()
  })

  test('account tab shows data export and delete', async ({ page }) => {
    await page.goto('/settings')
    await page.getByRole('button', { name: /^hesap$/i }).click({ force: true })
    await expect(page.getByRole('button', { name: /veri [iİ]ndir/i })).toBeVisible()
    await expect(page.getByText(/hesabı sil/i)).toBeVisible()
    await expect(page.getByText(/hesabı taşı/i)).toBeVisible()
  })
})
