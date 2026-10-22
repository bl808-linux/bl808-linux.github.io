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
| 2026-10-21 | M1s Dock, firmware `2f31e1c`, OpenSBI `6ad246a1` with UART patch, U-Boot `62c9805d` with board/UART changes, Linux `a804c574` | CPU_RTC clock enable changed fixed-zero time reads into advancing time reads; Linux completed the unaligned-access probe and reached rootfs mount |
| 2026-10-21 | M1s Dock, SRAM OpenSBI and S-mode U-Boot | UART3 console output and paced command input worked at 2 Mbps |

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
