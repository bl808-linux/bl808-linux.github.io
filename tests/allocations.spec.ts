import { test, expect } from '@playwright/test';
import { allocationMaps, flashMap, sramMaps, rangeMap } from '../src/data/allocations';
import { designSD, sdExamples, GiB, MiB } from '../src/data/sd-layout';

test('physical maps cover each extent exactly once and retain tiny firmware slots', () => {
  for (const map of [...allocationMaps, ...sdExamples.map(example => example.map)]) {
    if (map.kind !== 'range') continue;
    let cursor = map.start;
    const ids = new Set<string>();
    for (const region of map.regions) {
      expect(region.start, `${map.id}/${region.id}`).toBe(cursor);
      expect(region.end).toBeGreaterThan(region.start);
      expect(region.end).toBeLessThanOrEqual(map.end);
      expect(ids.has(region.id)).toBe(false);
      ids.add(region.id);
      cursor = region.end;
    }
    expect(cursor).toBe(map.end);
    expect(map.regions.reduce((bytes, region) => bytes + region.end - region.start, 0)).toBe(map.end - map.start);
  }
  const header = flashMap.regions.find(region => region.id === 'uboot-header')!;
  expect([header.start, header.end]).toEqual([0x0f1ff8, 0x0f2000]);
  expect(header.end - header.start).toBe(8);
  expect(flashMap.end).toBe(16 * MiB);
  const opensbi = sramMaps.find(map => map.id === 'mm-dram')!;
  expect([opensbi.start, opensbi.end]).toEqual([0x3ef80000, 0x3f000000]);
  expect(opensbi.end - opensbi.start).toBe(512 * 1024);
});

test('invalid overlapping allocations fail rather than rendering a misleading gauge', () => {
  const region = flashMap.regions[0];
  expect(() => rangeMap({ ...flashMap, regions: [region, { ...region, id: 'overlap' }] }, {
    label: 'Gap', state: 'unassigned', description: '', evidence: region.evidence,
  })).toThrow(/overlapping/);
});

test('SD profiles preserve fixed slots, reserve GPT tails and scale RAW from real capacity', () => {
  expect(sdExamples.map(({ map }) => {
    const root = map.regions.find(region => region.id === 'rootfs')!;
    return (root.end - root.start) / GiB;
  })).toEqual([5, 10, 16, 16, 16, 16]);
  const nominal = designSD(128_000_000_000);
  const measured = designSD(128_000_000_000 - MiB, 'measured');
  for (const map of [nominal, measured, designSD(2 ** 41)]) {
    const root = map.regions.find(region => region.id === 'rootfs')!;
    const raw = map.regions.find(region => region.id === 'raw')!;
    expect(root.start).toBe(542_113_792); // 517 MiB
    expect(raw.start).toBe(17_721_982_976); // 16 GiB + 517 MiB
    expect(raw.start / 512).toBe(34_613_248);
    expect(map.end - raw.end).toBeGreaterThanOrEqual(MiB);
    expect(map.end - raw.end).toBeLessThan(2 * MiB);
    expect((raw.end - raw.start) % MiB).toBe(0);
    expect(raw.end / 512).toBeLessThanOrEqual(2 ** 32);
    for (const id of ['linux-a', 'linux-b']) {
      const slot = map.regions.find(region => region.id === id)!;
      expect(slot.end - slot.start).toBe(256 * MiB);
    }
  }
  expect(nominal.regions.find(region => region.id === 'raw')!.end
    - measured.regions.find(region => region.id === 'raw')!.end).toBe(MiB);
  expect(() => designSD(8_000_000_000 - MiB)).not.toThrow();
  for (const invalid of [0, 4_000_000_000, 128_000_000_001, 2 ** 41 + 512, NaN, Infinity]) {
    expect(() => designSD(invalid)).toThrow();
  }
});

test('RAM stage charts distinguish load addresses, observed reservations and OS capacity', async ({ page }) => {
  await page.goto('/address-space/memory-map/');
  await expect(page.locator('#mm-dram-opensbi')).toContainText('512 KiB');
  await expect(page.locator('#mm-dram-opensbi')).toContainText('0x3ef80000');
  await expect(page.locator('#psram-load')).toContainText('not sized allocations');
  await expect(page.locator('#psram-load .allocation-track')).toHaveCount(0);
  await expect(page.locator('#psram-uboot')).toContainText('2026-10-21');
  await expect(page.locator('#psram-uboot-uboot-lmb')).toContainText('0x52da6750');
  await expect(page.locator('#psram-linux')).toContainText('not 64 MiB of free memory');
  await page.locator('#mm-dram .allocation-segment').focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#mm-dram-opensbi$/);
  await expect(page.locator('#mm-dram-opensbi')).toBeFocused();
});

test('eight-byte Flash header has an accessible legend and exact proportional width', async ({ page }) => {
  await page.goto('/storage/flash/');
  const header = page.locator('#nor-layout-uboot-header');
  await expect(header).toContainText('8 bytes');
  await expect(header).toContainText('0x000f1ff8');
  const tinySlot = page.getByRole('link', { name: /U-Boot length header, 8 bytes/ });
  expect(await tinySlot.evaluate(element => parseFloat((element as HTMLElement).style.width))).toBeCloseTo(8 / 16777216 * 100, 10);
  await header.getByRole('link', { name: /Firmware load contract/ }).focus();
  await expect(header.getByRole('link')).toBeFocused();
});

test('SD capacity selection changes the proposed geometry and labels it as design', async ({ page }) => {
  await page.goto('/storage/sd-card/#capacity-policy');
  const select = page.getByRole('combobox', { name: 'Proposed SD capacity' });
  await expect(select).toHaveValue('128');
  await expect(page.locator('#sd-128')).toBeVisible();
  await expect(page.locator('#sd-128-raw')).toContainText('0x420500000');
  await select.selectOption('8');
  await expect(page.locator('#sd-128')).toBeHidden();
  await expect(page.locator('#sd-8-rootfs')).toContainText('5 GiB');
  await expect(page.locator('#sd-8')).toContainText('not observed contents');
  await expect(page.getByRole('heading', { name: 'Compatibility and implementation status' })).toBeAttached();
});

test('allocation diagrams remain usable on mobile and without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  for (const path of ['/storage/overview/', '/address-space/memory-map/', '/storage/flash/', '/storage/sd-card/']) {
    await page.goto(`http://127.0.0.1:4321${path}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), path).toBeTruthy();
  }
  await expect(page.locator('#sd-128')).toBeVisible();
  const smallCard = page.locator('.sd-capacity-example[data-capacity="8"]');
  await smallCard.locator('summary').click();
  await expect(page.locator('#sd-8-rootfs')).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Proposed SD capacity' })).toBeHidden();
  await context.close();
});
