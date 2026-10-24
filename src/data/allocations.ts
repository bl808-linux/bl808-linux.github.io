// Board-specific allocation contracts, not live utilization measurements.
export type AllocationState = 'reserved' | 'temporary' | 'observed' | 'managed' | 'unassigned' | 'unknown' | 'planned';
export type Evidence = { label: string; href: string };
export type Allocation = {
  id: string;
  label: string;
  state: AllocationState;
  description: string;
  evidence: Evidence;
  role?: 'metadata' | 'control' | 'linux-a' | 'linux-b' | 'rootfs' | 'raw';
};
export type Region = Allocation & { start: number; end: number };
export type Marker = Allocation & { address: number };
type MapBase = { id: string; title: string; note: string };
export type RangeMap = MapBase & {
  kind: 'range'; start: number; end: number; unit: 'CPU address' | 'Physical NOR offset' | 'Proposed SD byte offset'; regions: Region[];
};
export type MarkerMap = MapBase & {
  kind: 'markers'; start: number; end: number; unit: 'CPU address'; markers: Marker[];
};
export type LogicalMap = MapBase & { kind: 'logical'; items: Allocation[] };
export type AllocationMap = RangeMap | MarkerMap | LogicalMap;

export const stateLabels: Record<AllocationState, string> = {
  reserved: 'Reserved capacity', temporary: 'Boot-time use', observed: 'Observed reservation',
  managed: 'OS-managed memory', unassigned: 'Unassigned in this layout',
  unknown: 'Contents not enumerated', planned: 'Proposed · not installed',
};

export function hex(value: number): string { return `0x${value.toString(16).padStart(8, '0')}`; }
export function capacity(bytes: number): string {
  for (const [unit, divisor] of [['GiB', 1073741824], ['MiB', 1048576], ['KiB', 1024]] as const) {
    if (bytes < divisor) continue;
    const value = bytes / divisor;
    const rounded = Math.round(value * 1000) / 1000;
    return `${rounded === value ? '' : '≈'}${rounded.toLocaleString('en-US', { maximumFractionDigits: 3 })} ${unit}`;
  }
  return `${bytes.toLocaleString('en-US')} bytes`;
}

// Fill every hole without implying that those bytes are safe to overwrite.
// Invalid contracts fail the static build rather than drawing plausible bars.
export function rangeMap(
  map: Omit<RangeMap, 'kind'>,
  gap: { label: string; state: 'unassigned' | 'unknown'; description: string; evidence: Evidence },
): RangeMap {
  if (!Number.isSafeInteger(map.start) || !Number.isSafeInteger(map.end) || map.start >= map.end) {
    throw new Error(`Invalid extent: ${map.id}`);
  }
  const regions: Region[] = [];
  let cursor = map.start;
  let gapNumber = 0;
  for (const region of [...map.regions].sort((a, b) => a.start - b.start)) {
    if (!Number.isSafeInteger(region.start) || !Number.isSafeInteger(region.end)
      || region.start < cursor || region.end <= region.start || region.end > map.end) {
      throw new Error(`Invalid or overlapping region: ${map.id}/${region.id}`);
    }
    if (cursor < region.start) regions.push({ ...gap, id: `gap-${++gapNumber}`, start: cursor, end: region.start });
    regions.push(region);
    cursor = region.end;
  }
  if (cursor < map.end) regions.push({ ...gap, id: `gap-${++gapNumber}`, start: cursor, end: map.end });
  return { ...map, kind: 'range', regions };
}

const memoryEvidence = { label: 'Memory windows & aliases', href: '/address-space/memory-map/#on-chip-memory-and-aliases' };
const loaderEvidence = { label: 'Firmware load contract', href: '/storage/flash/#headers-are-part-of-an-update' };
const sramEvidence = { label: 'SRAM boot path', href: '/address-space/core-views/#allocation-and-access-protection' };
const ubootEvidence = { label: 'U-Boot observation · 2026-10-21', href: '/address-space/core-views/#observed-u-boot-allocation' };
const flashEvidence = { label: 'NOR slot contract', href: '/storage/flash/#boot-firmware-placement' };
const sdEvidence = { label: 'SD file roles', href: '/storage/sd-card/#operating-system-contents' };
// Linker scripts at the inspected firmware revision; no sibling checkout is needed to build this site.
const firmwareRevision = '45c504ac1351370771479ced099c93b6768dd5b6';
const linkerEvidence = (core: 'm0' | 'd0'): Evidence => ({
  label: `${core.toUpperCase()} linker contract`,
  href: `https://github.com/bl808-linux/firmware/blob/${firmwareRevision}/${core}/link.ld`,
});

export const sramMaps: RangeMap[] = [
  rangeMap({
    id: 'mcu-sram', title: 'MCU SRAM · 224 KiB', unit: 'CPU address', start: 0x62020000, end: 0x62058000,
    note: 'M0 uses the 0x620… alias. The 0x220… view names the same bytes. WRAM capacity assumes assignment to the MCU.',
    regions: [
      { id: 'm0-runtime', label: 'M0 runtime & BSS', start: 0x62028000, end: 0x6202f000, state: 'reserved',
        description: '28 KiB linker capacity for SRAM-resident code, constants, data and BSS, including the USB update service. This is a capacity limit, not the linked image size.', evidence: linkerEvidence('m0') },
      { id: 'm0-stack', label: 'M0 stack', start: 0x6202f000, end: 0x62030000, state: 'reserved',
        description: 'Separate 4 KiB stack. M0 remains active while D0 runs the operating system.', evidence: linkerEvidence('m0') },
    ],
  }, { label: 'No assignment shown', state: 'unknown', description: 'No allocation is established here by the M0 linker contract. Bank ownership and other users must be checked before reuse; this is not measured free RAM.', evidence: memoryEvidence }),
  rangeMap({
    id: 'mm-dram', title: 'MM DRAM · 512 KiB internal SRAM', unit: 'CPU address', start: 0x3ef80000, end: 0x3f000000,
    note: 'OpenSBI stays in this internal SRAM bank after Linux starts. It does not reserve the front of external PSRAM.',
    regions: [{ id: 'opensbi', label: 'OpenSBI', start: 0x3ef80000, end: 0x3f000000, state: 'reserved',
      description: '512 KiB firmware reservation. The declared runtime copy includes zero padding/BSS; the binary need not fill the reservation.', evidence: loaderEvidence }],
  }, { label: 'Unassigned', state: 'unassigned', description: 'No allocation in this contract.', evidence: sramEvidence }),
  rangeMap({
    id: 'mm-vram', title: 'MM VRAM · 32 KiB internal SRAM', unit: 'CPU address', start: 0x3f000000, end: 0x3f008000,
    note: 'Used by the D0 loader before the OpenSBI handoff. No automatic reassignment to Linux is established.',
    regions: [
      { id: 'd0-data', label: 'D0 loader data & BSS', start: 0x3f000000, end: 0x3f004000, state: 'temporary',
        description: '16 KiB linker capacity for the loader’s initialized and zero-initialized data. The loader executes from NOR.', evidence: linkerEvidence('d0') },
      { id: 'd0-stack', label: 'D0 loader stack', start: 0x3f004000, end: 0x3f008000, state: 'temporary',
        description: '16 KiB stack during image loading. OpenSBI establishes its own runtime after handoff.', evidence: linkerEvidence('d0') },
    ],
  }, { label: 'Unassigned', state: 'unassigned', description: 'No allocation in this contract.', evidence: sramEvidence }),
];

export const psramLoadMap: MarkerMap = {
  id: 'psram-load', kind: 'markers', title: '1 / Initial firmware load · 64 MiB PSRAM',
  start: 0x50000000, end: 0x54000000, unit: 'CPU address',
  note: 'Ticks are load addresses, not sized allocations. Image headers determine how many bytes the loader copies.',
  markers: [
    { id: 'uboot-load', label: 'U-Boot load address', address: 0x50000000, state: 'temporary',
      description: 'Uncompressed U-Boot is copied here and later relocates itself. The NOR slot limit is not its measured RAM footprint.', evidence: loaderEvidence },
    { id: 'boot-dtb', label: 'Boot-firmware DTB', address: 0x51ff8000, state: 'temporary',
      description: 'Firmware-supplied device tree. Preserve its live contents while loading subsequent images.', evidence: loaderEvidence },
  ],
};
export const psramUbootMap = rangeMap({
  id: 'psram-uboot', title: '2 / U-Boot running · 2026-10-21 observation',
  start: 0x50000000, end: 0x54000000, unit: 'CPU address',
  note: 'A snapshot for the recorded image. Obtain current bdinfo reservations before choosing kernel or decompression buffers.',
  regions: [{ id: 'uboot-lmb', label: 'U-Boot LMB reservation', start: 0x52da6750, end: 0x54000000, state: 'observed',
    description: 'Includes the recorded relocated U-Boot at 0x53fc7000 and its FDT at 0x53da6760. This interval is not a permanent Linux reservation.', evidence: ubootEvidence }],
}, { label: 'Other PSRAM · live contents not enumerated', state: 'unknown',
  description: 'Includes live buffers such as the firmware-supplied DTB at 0x51ff8000. Being outside the recorded LMB interval does not make every byte available.', evidence: ubootEvidence });

export const psramLinuxMap = rangeMap({
  id: 'psram-linux', title: '3 / Linux running · 64 MiB PSRAM bank',
  start: 0x50000000, end: 0x54000000, unit: 'CPU address',
  note: 'Whole bank supplied to the OS, not 64 MiB of free memory. Kernel, runtime reservations, buffers and userspace share it.',
  regions: [{ id: 'linux-memory', label: 'Linux kernel & working memory', start: 0x50000000, end: 0x54000000, state: 'managed',
    description: 'Kernel, device tree, optional initramfs, page cache and applications. Their individual sizes depend on the selected image and runtime. Boot-time buffers do not imply permanent partitions.',
    evidence: { label: 'OS memory allocation', href: '/address-space/core-views/#core-and-privilege-context' } }],
}, { label: 'Unassigned', state: 'unassigned', description: 'No allocation in this contract.', evidence: memoryEvidence });
export const psramMaps = [psramLoadMap, psramUbootMap, psramLinuxMap];

export const flashMap = rangeMap({
  id: 'nor-layout', title: 'SPI NOR · 16 MiB physical device', unit: 'Physical NOR offset', start: 0, end: 0x1000000,
  note: 'Widths show slot capacities, including every gap. Actual programmed lengths can be smaller. Tiny slots remain listed below at their exact size.',
  regions: [
    { id: 'group0', label: 'Group0 metadata', start: 0, end: 0x1000, state: 'reserved', description: 'ROM boot metadata and Flash configuration table for M0.', evidence: flashEvidence },
    { id: 'group1', label: 'Group1 metadata', start: 0x1000, end: 0x2000, state: 'reserved', description: 'ROM boot metadata for the D0 loader.', evidence: flashEvidence },
    { id: 'm0-body', label: 'M0 firmware', start: 0x2000, end: 0x52000, state: 'reserved', description: '320 KiB body slot. Runtime code and data are copied into MCU SRAM.', evidence: flashEvidence },
    { id: 'd0-body', label: 'D0 loader', start: 0x52000, end: 0xa2000, state: 'reserved', description: '320 KiB body slot for PSRAM initialization and image loading.', evidence: flashEvidence },
    { id: 'dtb', label: 'Boot-firmware DTB', start: 0xd2000, end: 0xe2000, state: 'reserved', description: '64 KiB slot for the firmware device tree. The Linux DTB is a separate SD file.', evidence: flashEvidence },
    { id: 'uboot-header', label: 'U-Boot length header', start: 0xf1ff8, end: 0xf2000, state: 'reserved', description: 'Eight bytes: load address and body length. Its erase sector contains other bytes that updates must preserve.', evidence: loaderEvidence },
    { id: 'uboot', label: 'U-Boot body', start: 0xf2000, end: 0x552000, state: 'reserved', description: '4,587,520-byte slot (4.375 MiB) for uncompressed U-Boot.', evidence: flashEvidence },
    { id: 'opensbi', label: 'OpenSBI image', start: 0x852000, end: 0x8d2000, state: 'reserved', description: '512 KiB slot, including declared zero padding. OpenSBI executes from internal SRAM.', evidence: flashEvidence },
  ],
}, { label: 'Unassigned in the SD OS layout', state: 'unassigned',
  description: 'No role is assigned by this documented layout. This does not establish erased contents, a recovery bank or permission to overwrite an installed image. Older bundles may retain other data here.', evidence: flashEvidence });

export const sdPlan: LogicalMap = {
  id: 'sd-plan', kind: 'logical', title: 'SD card · proposed GPT installation',
  note: 'Roles in address order, not size ratios. Capacity examples below calculate exact boundaries; this layout is not installed on the recorded card.',
  items: [
    { id: 'control', label: 'BOOTCTRL · 4 MiB', role: 'control', state: 'planned', description: 'Dedicated raw boot-selection state, with two redundant records. Protective MBR/GPT and alignment space are outside this partition.', evidence: { label: 'Boot metadata design', href: '/storage/sd-card/#boot-sectors-and-partition-contract' } },
    { id: 'linux-a', label: 'LINUX_A · 256 MiB', role: 'linux-a', state: 'planned', description: 'FAT32 kernel slot A: matching kernel, DTB, optional small initramfs and an integrity manifest.', evidence: { label: 'A/B update design', href: '/storage/sd-card/#ab-kernel-update-and-recovery' } },
    { id: 'linux-b', label: 'LINUX_B · 256 MiB', role: 'linux-b', state: 'planned', description: 'Same size and file contract as A. Stage updates in the inactive slot and keep the confirmed slot intact.', evidence: { label: 'A/B update design', href: '/storage/sd-card/#ab-kernel-update-and-recovery' } },
    { id: 'rootfs', label: 'Debian rootfs · up to 16 GiB', role: 'rootfs', state: 'planned', description: 'Shared ext4 root, packages, matching modules for both retained kernels and ordinary user files. Smaller cards receive a smaller rootfs.', evidence: { label: 'Capacity policy', href: '/storage/sd-card/#capacity-policy' } },
    { id: 'raw', label: 'RAW · remaining capacity', role: 'raw', state: 'planned', description: 'Named, unformatted partition for application-defined binary records. Discover its GPT boundaries instead of hard-coding an offset for a 128 GB card.', evidence: { label: 'RAW access contract', href: '/storage/sd-card/#raw-region-ownership-and-format' } },
  ],
};

export const allocationMaps: AllocationMap[] = [...sramMaps, ...psramMaps, flashMap, sdPlan];
