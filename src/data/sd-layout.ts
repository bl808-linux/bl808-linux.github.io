import { rangeMap, type RangeMap, type Region } from './allocations';

export const MiB = 1024 ** 2;
export const GiB = 1024 ** 3;
export const sdSizesGB = [8, 16, 32, 64, 128, 256];
export const sdPolicy = { sectorBytes: 512, alignmentBytes: MiB, bootBytes: 256 * MiB, exchangeBytes: 512 * MiB };
const evidence = { label: 'Current MBR contract', href: '/storage/sd-card/#boot-sectors-and-partition-contract' };

// Mirrors the host partition calculation without accessing or changing a card.
export function designSD(cardBytes: number, id = 'custom'): RangeMap {
  if (!Number.isSafeInteger(cardBytes) || cardBytes % sdPolicy.sectorBytes !== 0
    || cardBytes <= 0 || cardBytes > 2 ** 41) {
    throw new Error('SD layout requires positive sector-aligned capacity within 2 TiB');
  }
  const usableEnd = Math.floor(cardBytes / MiB) * MiB;
  const rootfsStart = MiB + sdPolicy.bootBytes;
  const exchangeStart = usableEnd - sdPolicy.exchangeBytes;
  if (exchangeStart <= rootfsStart) throw new Error('Insufficient ROOTFS space');
  const regions: Region[] = [
    { id: 'head', label: 'MBR & front alignment', start: 0, end: MiB, state: 'planned', role: 'metadata',
      description: 'LBA 0 contains the MBR partition table and disk signature. The remaining bytes to 1 MiB are outside the partitions. Board firmware stays in NOR.', evidence },
    { id: 'boot', label: 'p1 / BOOT', start: MiB, end: rootfsStart, state: 'planned', role: 'boot',
      description: '256 MiB, MBR type 0x0c (FAT32 LBA). Intended for the kernel, matching Linux DTB and optional initramfs. The partition command does not create a filesystem.', evidence },
    { id: 'rootfs', label: 'p2 / ROOTFS', start: rootfsStart, end: exchangeStart, state: 'planned', role: 'rootfs',
      description: 'All aligned space between BOOT and EXCHANGE, MBR type 0x83 (Linux). Intended for the Debian ext4 image, packages, modules and ordinary files. No 16 GiB cap.', evidence },
    { id: 'exchange', label: 'p3 / EXCHANGE', start: exchangeStart, end: usableEnd, state: 'planned', role: 'exchange',
      description: '512 MiB RAW transfer area, MBR type 0xda. No filesystem or automatic mount. Package framing, names, lengths and checksums remain to be defined.', evidence },
  ];
  if (usableEnd < cardBytes) regions.push({ id: 'tail', label: 'Tail alignment slack', start: usableEnd, end: cardBytes, state: 'planned', role: 'metadata',
    description: 'Less than 1 MiB outside the partitions after rounding the measured capacity down. There is no backup GPT or fixed tail reservation.', evidence });
  return rangeMap({
    id: `sd-${id}`, title: `${id === 'custom' ? 'Measured card' : `${id} GB card`} · MBR partition capacities`,
    start: 0, end: cardBytes, unit: 'SD byte offset', regions,
    note: 'Host implementation, not observed card contents. Card provisioning and Debian boot remain unverified on the recorded board. GB is decimal; GiB is binary. Use the measured sector count.',
  }, { label: 'Alignment slack', state: 'unassigned', description: 'No partition owns these bytes.', evidence });
}

export const sdExamples = sdSizesGB.map(size => ({ size, map: designSD(size * 1_000_000_000, String(size)) }));
export function sizeGiB(bytes: number): string { return `${(bytes / GiB).toFixed(2)} GiB`; }
