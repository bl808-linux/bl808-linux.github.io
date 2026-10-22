---
title: "Board observations"
description: "Established M1s Dock observations and their software context."
---

These observations describe particular M1s Dock board sessions. Each result
applies to the boot configuration and operation recorded for that session.

## Established observations

| Date | Board / software context | Established result |
| --- | --- | --- |
| 2026-10-20 | M1s Dock, generic OpenSBI and S-mode U-Boot diagnostic | Repeated SDH command/forced events reached supervisor external cause 9 with PLIC claim 81 and MCU source bit 17 |
| 2026-10-20 | M1s Dock, S-mode timer diagnostic | Three SBI timer requests produced three supervisor timer interrupts |
| 2026-10-21 | M1s Dock, firmware `2f31e1c`, OpenSBI `6ad246a1` with UART patch, U-Boot `62c9805d` with board/UART changes, Linux `a804c574` | Applying CPU_RTC configuration `0x8000017b` changed fixed-zero time reads into advancing time reads; Linux completed the unaligned-access probe and reached rootfs mount |
| 2026-10-21 | M1s Dock, SRAM OpenSBI and S-mode U-Boot | UART3 console output and paced command input worked at 2 Mbps |
| 2026-10-21 | M1s Dock, firmware `2f31e1c`, OpenSBI `6ad246a1` with UART changes and U-Boot `62c9805d` with board/UART changes | A recorded power-on boot and a recorded board-RESET boot produced matching selected clock, UART and PLIC readbacks at the U-Boot prompt |
| 2026-10-21 | Same S-mode U-Boot build | Reads at `0xe400bff8`, `0xe0002100` and `0xe0002108` raised load access faults; U-Boot's reset path required a physical board RESET |
| 2026-10-22 | M1s Dock, S-mode U-Boot `2026.10-g62c9805d8d57-dirty`, 2 Mbps console | After CPU_RTC initialization, `loads` received 1 KiB into PSRAM; PC and RAM CRC32 both read `b70b4c26`; the original RTC control word was restored and the prompt remained responsive |

## Power-on and board-RESET readbacks

The comparison used one boot after USB power was disconnected and reconnected,
and one boot after the board RST button was pressed. Both reached U-Boot
`2026.10-g62c9805d8d57-dirty`, built on 2026-10-21 at 19:22:34, with the same
images. A 752-byte RAM readback probe passed upload CRC `123440e5` and returned
normally in both sessions.

The selected values below matched in those two sessions, before the manual RTC
clock configuration was applied:

| Interface | Address | Value in both sessions |
| --- | --- | --- |
| CPU_RTC | `0x30000018` | `0x0000000a` |
| MM_CLK_CTRL_CPU | `0x30007000` | `0x45105d2f` |
| MM_CLK_CPU | `0x30007004` | `0x00010100` |
| MM_CLK_CTRL_PERI | `0x30007010` | `0x00810300` |
| UART3 UTX_CONFIG | `0x30002000` | `0x00000f05` |
| UART3 URX_CONFIG | `0x30002004` | `0x00000701` |
| UART3 UART_BIT_PRD | `0x30002008` | `0x00130013` |
| Context 0 threshold | `0xe0200000` | `0x00000007` |
| Context 1 threshold | `0xe0201000` | `0x00000007` |
| `sie` CSR | Hart 0 | `0x0` |
| `time` CSR | Hart 0 | `0x0` |

These are values after boot-chain initialization, not hardware reset defaults.
The comparison establishes agreement for the listed values in those sessions,
not equality of every register or a guarantee for other images.

The [MM_GLB readback](/clocks/mm-glb/#m1s-dock-boot-readback),
[UART readback](/uart/overview/#m1s-dock-boot-readback),
[PLIC context state](/interrupts/plic/#m1s-dock-boot-readback) and
[U-Boot allocation](/address-space/core-views/#observed-u-boot-allocation)
describe the corresponding interfaces.

## Normal-boot UART file transfer

A clean 2026-10-22 run started with CPU_RTC `0x0000000a`, applied
`0x8000017b`, and received a 1,024-byte PC payload through U-Boot's `loads`
command. U-Boot reported first address `0x51220000`, last address
`0x512203ff` and total size `0x400`. Its RAM CRC32 matched the original file's
`b70b4c26`; a read of the first 16 bytes also matched the payload.

After reception, the original CPU_RTC value `0x0000000a` was restored and
`version` returned the same U-Boot banner. The destination was PSRAM and the
run did not execute the received data or modify NOR.

An earlier stopped-counter session consumed the S7 terminator without
returning a completion summary. The
[delay dependency](/clocks/rtc/#u-boot-delay-dependency) explains the tested
receiver's requirement for an advancing counter. The
[UART description](/uart/overview/#normal-boot-file-reception) records the
transfer interface and result.

## Interpreting the results

The [RTC observation](/clocks/rtc/#observed-enable-behavior) establishes that
the counter advanced after its clock configuration changed. Its absolute
frequency was not independently measured in that experiment.

The [SDH observation](/interrupts/m0ic/#sdh-delivery-path) establishes one
peripheral route through the forwarding controller and PLIC. Polling UART
output exercises a separate path.

Logs, diagnostic sources, image hashes and the checking history are retained in
the local laboratory archive. The [notation guide](/references/notation/)
describes the register tables and address conventions used throughout this manual.
