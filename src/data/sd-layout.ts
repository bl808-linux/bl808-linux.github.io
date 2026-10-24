import { rangeMap, type RangeMap, type Region } from './allocations';

export const MiB = 1024 ** 2;
export const GiB = 1024 ** 3;
export const sdSizesGB = [8, 16, 32, 64, 128, 256];
export const sdPolicy = { sectorBytes: 512, alignmentBytes: MiB, controlBytes: 4 * MiB, kernelSlotBytes: 256 * MiB, rootfsCapBytes: 16 * GiB };
const evidence = { label: 'Proposed SD contract', href: '/storage/sd-card/#boot-sectors-and-partition-contract' };

// Pure documentation calculator. It does not read, format or resize a card.
export function designSD(cardBytes: number, id = 'custom'): RangeMap {
  if (!Number.isSafeInteger(cardBytes) || cardBytes % sdPolicy.sectorBytes !== 0
    || cardBytes <= 0 || cardBytes > 2 ** 41) {
    throw new Error('SD design requires positive sector-aligned capacity within 2 TiB');
  }
  const usableEnd = Math.floor((cardBytes - MiB) / MiB) * MiB;
  const rootfsStart = MiB + sdPolicy.controlBytes + 2 * sdPolicy.kernelSlotBytes;
  const remaining = usableEnd - rootfsStart;
  const rootfsBytes = Math.min(sdPolicy.rootfsCapBytes, Math.floor(remaining * 0.75 / GiB) * GiB);
  if (rootfsBytes < 4 * GiB || remaining - rootfsBytes < GiB) throw new Error('Insufficient rootfs or RAW space');
  let cursor = MiB;
  const regions: Region[] = [{ id: 'head', label: 'Boot sectors & front alignment', start: 0, end: MiB, state: 'planned', role: 'metadata',
    description: 'LBA 0 protective MBR; LBA 1 primary GPT header; LBA 2–33 entry array (128 × 128 bytes). Remaining bytes to 1 MiB are reserved alignment space. No OpenSBI or U-Boot image is installed here.', evidence }];
  function partition(id: string, label: string, bytes: number, role: Region['role'], description: string) {
    regions.push({ id, label, start: cursor, end: cursor + bytes, state: 'planned', role, description, evidence });
    cursor += bytes;
  }
  partition('bootctrl', 'p1 / BOOTCTRL', sdPolicy.controlBytes, 'control', '4 MiB unformatted control partition. Two independent 4 KiB records at partition-relative 0 and 1 MiB; preserve the remainder for future control-format versions.');
  partition('linux-a', 'p2 / LINUX_A', sdPolicy.kernelSlotBytes, 'linux-a', '256 MiB FAT32, kernel slot A. Kernel, matching DTB, optional compact initramfs and integrity manifest. Not the Debian root filesystem.');
  partition('linux-b', 'p3 / LINUX_B', sdPolicy.kernelSlotBytes, 'linux-b', '256 MiB FAT32, kernel slot B. Same file contract as A; inactive slot receives the next candidate image.');
  partition('rootfs', 'p4 / DEBIAN_ROOT', rootfsBytes, 'rootfs', 'Shared ext4 Debian rootfs, ordinary files and modules for both kernels. Capacity policy caps this partition at 16 GiB. Kernel rollback does not roll back package or filesystem changes.');
  partition('raw', 'p5 / RAW', usableEnd - cursor, 'raw', 'All remaining aligned usable capacity. No filesystem or automatic mount. Consumers discover the partition GUID, start LBA and block count rather than using a capacity-specific hard-coded offset.');
  regions.push({ id: 'tail', label: 'Tail reserve & backup GPT', start: usableEnd, end: cardBytes, state: 'planned', role: 'metadata',
    description: 'At least 1 MiB reserved at the physical end. The backup entry array occupies the 32 sectors before the final-sector GPT header. Alignment slack stays outside RAW.', evidence });
  return rangeMap({
    id: `sd-${id}`, title: `${id === 'custom' ? 'Measured card' : `${id} GB card`} · proposed partition capacities`,
    start: 0, end: cardBytes, unit: 'Proposed SD byte offset', regions,
    note: 'Proportional design, not observed contents. GB is decimal; GiB is binary. Actual provisioning must calculate from the card’s measured sector count.',
  }, { label: 'Reserved alignment', state: 'unassigned', description: 'No partition owns these bytes.', evidence });
}

export const sdExamples = sdSizesGB.map(size => ({ size, map: designSD(size * 1_000_000_000, String(size)) }));
export function sizeGiB(bytes: number): string { return `${(bytes / GiB).toFixed(2)} GiB`; }
