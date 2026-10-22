---
title: "Core views & aliases"
description: "Core address views, storage offsets, cache aliases and protection."
---

## The same XIP entry can map different images

The M1s boot headers select a physical NOR body for each CPU group. Both current minimal firmware images enter at CPU address `0x58000000`, while their physical bodies begin at different NOR offsets.

| Consumer | CPU XIP address | Physical NOR offset | Meaning |
| --- | --- | --- | --- |
| M0 / Group0 | `0x58000000` | `0x002000` | M0 firmware body |
| D0 / Group1 | `0x58000000` | `0x052000` | D0 firmware body |
| D0 | `0x58080000` | `0x0d2000` | DTB slot in this boot layout |
| D0 | `0x580a0000` | `0x0f2000` | U-Boot payload in this boot layout |
| D0 | `0x58800000` | `0x852000` | OpenSBI payload slot |

For the D0 mapping above:

```text
physical NOR offset = CPU address - 0x58000000 + 0x52000
```

This relationship describes that group mapping. It is not a conversion rule for every SoC bus window. A Flash offset must never be passed to a CPU memory-copy command as though it were a mapped CPU address.

## Cache aliases

MCU SRAM, MM DRAM and MM VRAM have cached and uncached address views. Each pair names the same physical storage. Changing an alias changes the CPU access path; it does not allocate a second memory.

A coherent software policy must account for the selected alias, the live cache configuration and the ownership of a buffer. The linker location alone does not establish the current cache state.

## Allocation and access protection

A device-tree `reserved-memory` entry tells the operating system which bytes to leave unallocated. Its `no-map` property controls the operating system's mapping policy. PMP controls hardware access permissions according to privilege mode. These mechanisms have different purposes.

In the SRAM boot path, OpenSBI remains resident in `[0x3ef80000, 0x3f000000)`. The loader's data and stack occupy the separate MM VRAM window `[0x3f000000, 0x3f008000)` during loading. PSRAM holds U-Boot and then Linux.

A failed S-mode access describes that access under the active firmware protection policy. It is not a complete specification of a physical memory bank or proof that an alias is absent.

## Observed U-Boot allocation

In the paired 2026-10-21 power-on and board-RESET sessions, `bdinfo` reported:

| Item | Recorded address or interval |
| --- | --- |
| DRAM bank | `[0x50000000, 0x54000000)` |
| U-Boot LMB reserved interval | `[0x52da6750, 0x54000000)` |
| Relocated U-Boot address | `0x53fc7000` |
| U-Boot FDT address | `0x53da6760` |
| Firmware-supplied FDT address | `0x51ff8000` |

These are allocations for that image, not fixed SoC reservations or a
full-capacity memory test. A load buffer must preserve live data such as the
firmware-supplied FDT as well as the reported reserved interval. Obtain the
current addresses for the image being used; see the
[recorded boot context](/references/observations/#power-on-and-board-reset-readbacks).

## Core and privilege context

| Operation | Context that establishes it |
| --- | --- |
| Release D0 and multimedia power/reset | M0 startup code in the minimal firmware path |
| Initialize external PSRAM and release MM SRAM banks | D0 loader before the OpenSBI handoff |
| Establish M-mode runtime protection | OpenSBI domain initialization |
| Allocate and map OS memory | Linux from the supplied device tree |

The [address map](/address-space/memory-map/) describes the memory windows.
The [storage layout](/storage/overview/) separates NOR boot firmware from Linux
on SD and from the RAM used to execute those images.
