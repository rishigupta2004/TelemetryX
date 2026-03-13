import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(() => {
    window.sessionStorage.setItem('telemetryx_loaded', 'true')
    ;(window as { __TELEMETRYX_VISUAL_TEST__?: boolean }).__TELEMETRYX_VISUAL_TEST__ = true

    let seed = 1337
    Math.random = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
  })
})

test('homepage hero and sections visual baseline', async ({ page }) => {
  await page.goto('/')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForSelector('[data-home-section="hero"]', { state: 'visible' })
  await page.waitForFunction(() => document.fonts?.status === 'loaded')
  await expect(page).toHaveScreenshot('home-fullpage.png', { fullPage: true })
})

test('engine page visual baseline', async ({ page }) => {
  await page.goto('/engine')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => document.fonts?.status === 'loaded')
  await expect(page).toHaveScreenshot('engine-fullpage.png', { fullPage: true })
})

test('features page visual baseline', async ({ page }) => {
  await page.goto('/features')
  await page.waitForLoadState('domcontentloaded')
  await page.waitForFunction(() => document.fonts?.status === 'loaded')
  await expect(page).toHaveScreenshot('features-fullpage.png', { fullPage: true })
})
