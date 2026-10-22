---
title: "Memory map"
description: "BL808 control blocks, memories and board-specific address windows."
---

An address must be read together with its core view and mapping. Register blocks below are CPU addresses. SPI NOR placement is described separately as a physical storage offset.

## Control and peripheral regions

| Base | End, exclusive | Size | Block | Interface |
| --- | --- | --- | --- | --- |
| `0x20000000` | `0x20001000` | 4 KiB | GLB | MCU clock, peripheral and interrupt-forwarding controls |
| `0x2000e000` | `0x2000f000` | 4 KiB | PDS | MCU clock-parent and power/reset controls |
| `0x2000f000` | `0x20010000` | 4 KiB | HBN | Always-on root-clock selection |
| `0x20060000` | `0x20061000` | 4 KiB | SDH | SD host controller |
| `0x30000000` | `0x30001000` | 4 KiB | MM_MISC | C906 boot, time-clock and shared-memory controls |
| `0x30002000` | `0x30003000` | 4 KiB | UART3 | Multimedia UART0 instance |
| `0x30007000` | `0x30008000` | 4 KiB | MM_GLB | Multimedia clock and reset controls |
| `0xe0000000` | `0xe4000000` | 64 MiB | PLIC aperture | Source and context register windows |
| `0xe4000000` | `0xe400c000` | 48 KiB | CLINT window used by the boot DT | Core-local software and timer registers |

The sizes are block windows, not counts of implemented registers. For example, the PLIC aperture contains widely separated context windows; it is not 64 MiB of RAM.

## On-chip memory and aliases

| CPU view | End, exclusive | Capacity | Memory | Alias of the same storage |
| --- | --- | --- | --- | --- |
| `0x22020000` | `0x22058000` | 224 KiB | MCU OCRAM plus WRAM when assigned to the MCU | `0x62020000` |
| `0x3ef80000` | `0x3f000000` | 512 KiB | MM DRAM, on-chip SRAM | `0x7ef80000` |
| `0x3f000000` | `0x3f008000` | 32 KiB | MM VRAM, on-chip SRAM | `0x7f000000` |

The SDK name **MM DRAM** refers to internal SRAM. External PSRAM is a separate device. WRAM ownership and the shared-bank release controls affect its use; address aliases do not increase total capacity.

See [core views and aliases](/address-space/core-views/) for cache and protection semantics.

## M1s Dock external memory

| CPU address | End, exclusive | Capacity | Meaning |
| --- | --- | --- | --- |
| `0x50000000` | `0x54000000` | 64 MiB | Populated external PSRAM, after controller and PHY initialization |
| `0x58000000` | `0x5c000000` | 64 MiB aperture | Primary XIP CPU window; the board's physical NOR is 16 MiB |

The address-space aperture and the fitted device capacity are different quantities. The linker, loader, device tree and operating system must agree on the actual allocation of those memories.

## Cross-reference

- [GLB clock controls](/clocks/glb/) and [MM_GLB](/clocks/mm-glb/).
- [PLIC register addressing](/interrupts/plic/#register-addressing).
- [C906 time-counter clock](/clocks/rtc/).
- [Sources](/references/sources/#memory-and-register-definitions): vendor `bl808.h`, the reference manual and board boot sources.
