import { test, expect } from '@playwright/test';

test('reference navigation, deep links and register decoder', async ({ page }) => {
  await page.goto('/clocks/rtc/#cpu-rtc');
  const register = page.locator('#cpu-rtc');
  await expect(register).toContainText('0x30000018');
  await register.getByText('Decode a register value', { exact: true }).click();
  const value = register.getByRole('textbox');
  await value.fill('0x8000017b');
  await expect(register.locator('tr[data-lsb="31"] output')).toHaveText('0x1');
  await expect(register.locator('tr[data-lsb="0"] output')).toHaveText('0x17b');
  await value.fill('0x100000000');
  await expect(value).toHaveAttribute('aria-invalid', 'true');
  await expect(register.getByRole('status')).toContainText('0xffffffff');
  await page.getByRole('link', { name: 'Clock tree', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Clock tree');
});

test('source map filters controller assignments without confusing source IDs', async ({ page }) => {
  await page.goto('/interrupts/sources/');
  const search = page.getByRole('searchbox', { name: 'Find an interrupt' });
  await search.fill('UART3');
  await expect(page.locator('.source-map tbody tr:visible')).toHaveCount(1);
  await expect(page.locator('.source-map tbody tr:visible')).toContainText('20');
  await search.fill('81');
  await expect(page.locator('.source-map tbody tr:visible')).toContainText('WL_ALL');
  await search.fill('no-such-source');
  await expect(page.locator('.filter-count')).toHaveText('0 source IDs');
  await search.fill('');
  await expect(page.locator('.source-map tbody tr:visible')).toHaveCount(67);
});

test('static reference remains readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4321/uart/registers/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('UART registers');
  await expect(page.locator('#uart-period')).toContainText('cr_utx_bit_prd');
  await expect(page.locator('#uart-read')).toContainText('Reading consumes data');
  await context.close();
});

test('site search resolves a register term', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Search/ }).click();
  const search = page.getByRole('searchbox').last();
  await search.fill('C906_RTC_DIV');
  await expect(page.locator('.pagefind-ui__result-link').first()).toBeVisible();
  await expect(page.locator('.pagefind-ui__result-link').first()).toContainText(/RTC|counter/i);
});

test('mobile layout confines wide register tables and supports navigation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/clocks/rtc/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBeTruthy();
  const menu = page.getByRole('button', { name: /Menu/i });
  await menu.click();
  await page.getByRole('link', { name: 'Interrupt topology', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Interrupt topology');
});

test('published navigation contains no experimental section', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('BL808 Reference Manual');
  await expect(page.locator('nav a[href*="experimental"], nav a[href*="experiments"]')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Clocks & reset →', exact: true })).toBeVisible();
});
