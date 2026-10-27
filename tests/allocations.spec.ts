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

test('SD MBR layout fixes BOOT and EXCHANGE and gives remaining aligned space to ROOTFS', () => {
  const nominal = designSD(128_000_000_000);
  const measured = designSD(128_000_000_000 - MiB, 'measured');
  for (const map of [...sdExamples.map(example => example.map), measured, designSD(2 ** 41)]) {
    const boot = map.regions.find(region => region.id === 'boot')!;
    const root = map.regions.find(region => region.id === 'rootfs')!;
    const exchange = map.regions.find(region => region.id === 'exchange')!;
    expect(boot.start).toBe(MiB);
    expect(boot.end - boot.start).toBe(256 * MiB);
    expect(root.start).toBe(269_484_032); // 257 MiB, LBA 526336
    expect(root.end).toBe(exchange.start);
    expect(root.end).toBeGreaterThan(root.start);
    expect(exchange.end - exchange.start).toBe(512 * MiB);
    expect(exchange.end).toBe(Math.floor(map.end / MiB) * MiB);
    expect(map.end - exchange.end).toBeGreaterThanOrEqual(0);
    expect(map.end - exchange.end).toBeLessThan(MiB);
    expect(exchange.end / 512).toBeLessThanOrEqual(2 ** 32);
    for (const region of [boot, root, exchange]) {
      expect(region.start % MiB).toBe(0);
      expect(region.end % MiB).toBe(0);
    }
    expect(map.regions.filter(region => ['boot', 'rootfs', 'exchange'].includes(region.id))).toHaveLength(3);
  }
  const root = nominal.regions.find(region => region.id === 'rootfs')!;
  expect(root.end - root.start).toBe(127_193_317_376);
  expect(root.end / 512).toBe(248_950_784);
  expect(root.end - root.start).toBeGreaterThan(16 * GiB);
  expect(root.end - measured.regions.find(region => region.id === 'rootfs')!.end).toBe(MiB);
  expect(designSD(2 ** 41).regions.some(region => region.id === 'tail')).toBe(false);
});

test('SD capacity checks match the host geometry limits without promising image fit', () => {
  const smallest = designSD(770 * MiB);
  const root = smallest.regions.find(region => region.id === 'rootfs')!;
  expect(root.end - root.start).toBe(MiB);
  for (const invalid of [0, -512, 769 * MiB, 770 * MiB - 512, 128_000_000_001, 2 ** 41 + 512, NaN, Infinity]) {
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

test('SD capacity selection shows the implemented MBR layout without claiming deployment', async ({ page }) => {
  await page.goto('/storage/sd-card/#capacity-policy');
  const select = page.getByRole('combobox', { name: 'SD capacity example' });
  await expect(select).toHaveValue('128');
  await expect(page.locator('#sd-128')).toBeVisible();
  await expect(page.locator('#sd-128-exchange')).toContainText('512 MiB');
  await expect(page.locator('#sd-128-rootfs')).toContainText('118.458 GiB');
  await expect(page.locator('#sd-plan-boot')).toBeVisible();
  await expect(page.locator('#sd-plan-exchange')).toBeVisible();
  await expect(page.locator('#sd-plan-control, #sd-plan-linux-a, #sd-plan-linux-b')).toHaveCount(0);
  await select.selectOption('8');
  await expect(page.locator('#sd-128')).toBeHidden();
  await expect(page.locator('#sd-8-rootfs')).toContainText('6.699 GiB');
  await expect(page.locator('#sd-8')).toContainText('not observed card contents');
  await expect(page.locator('#sd-8')).toContainText('Host implementation');
  await expect(page.getByText('It only writes the partition table', { exact: false })).toBeVisible();
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
  await expect(page.getByRole('combobox', { name: 'SD capacity example' })).toBeHidden();
  await context.close();
});
