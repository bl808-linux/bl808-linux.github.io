import { test, expect } from '@playwright/test';

test('English vendor manuals retain register tables and diagrams', async ({ page }) => {
  await page.goto('/vendor/bl808/');
  await expect(page.getByRole('link', { name: 'Datasheet 1.2 — English' })).toBeVisible();
  await page.getByRole('link', { name: 'Reference Manual 1.3 — English' }).click();
  await page.goto('/vendor/bl808/BL808_RM/en/content/SDH.html#clock-control');
  const register = page.locator('#clock-control');
  await expect(register).toContainText('0x2006002c');
  await expect(register.locator('table')).toContainText('SDCLK');
  const images = page.locator('img');
  await expect.poll(() => images.evaluateAll(elements =>
    elements.every(element => (element as HTMLImageElement).complete &&
      (element as HTMLImageElement).naturalWidth > 0))).toBeTruthy();
  const manifest = await (await page.request.get('/vendor/bl808/manifest.json')).json();
  expect(manifest.manuals).toHaveLength(2);
  expect(manifest.manuals.map((manual: { content_pages: number }) => manual.content_pages)).toEqual([13, 56]);
});

test('the mirrored manual search works from its nested path', async ({ page }) => {
  await page.goto('/vendor/bl808/BL808_RM/en/search.html?q=Clock_Control&check_keywords=yes&area=default');
  const results = page.locator('#search-results');
  await expect(results.locator('a').first()).toBeVisible({ timeout: 20000 });
  await expect(results).toContainText(/clock|SDH/i);
  await page.goto('/vendor/bl808/BL808_DS/en/content/Pindefinition.html');
  await expect(page.getByRole('heading', { level: 1 })).toContainText(/pin/i);
});
