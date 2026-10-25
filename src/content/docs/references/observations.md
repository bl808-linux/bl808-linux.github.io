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
| 2026-10-23 | M1s Dock, RAM S-mode diagnostic, OpenSBI `6ad246a1`, U-Boot base `62c9805d` | Actual UART3 RX reached PLIC 20; SDH reached PLIC 81; priority arbitration, forwarding-latch behavior, RTC divider/reset and SDH peripheral reset were exercised |
| 2026-10-23 | M1s Dock, RAM Linux `7.3.0-ga804c5742bff-dirty` with local SDH/IRQ/clock drivers, initramfs | Native parent/child IRQ progress, PIO and SDMA pattern writes, independent reads and original/neighbor restoration passed; both 96 MHz and 95 MHz SDH parents were used |
| 2026-10-23 | M1s Dock, current Linux `a804c574`, local native UART driver and RAM-only fixed-clock DT | Paced RX/TX comparisons at three baud rates and 100 actual last-close/open cycles passed; unpaced 1 Mbps RX exposed a hardware FIFO overrun |
| 2026-10-23 | M1s Dock, powered card, warm-POR command probe and native Linux SDH comparison | Explicit initialization-clock generation changed first-CMD8 success from 0/7 to 7/7; native Linux first CMD8 and five re-probes succeeded after the change |
| 2026-10-24 | M1s Dock, updated M0/firmware DTB/U-Boot and RAM Linux `7.3.0-g0b106a97216e-dirty` with Rust UART3 | OpenSBI, U-Boot and native Linux console worked at 115200 with a 40 MHz UART3 input clock; image upload used a temporary 2 Mbps setting and restored 115200 before Linux |

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

## M0 USB firmware update and software reboot

On 2026-10-22, the M1s Dock ran a Rust M0 service from MCU SRAM and
OpenSBI/U-Boot on D0. The service used the native OTG port, USB DFU identity
`1209:0001`, product `BL808 M0 DFU`, and 64-byte transfers into a 4 KiB buffer.

The image-update run programmed and independently read back 123 NOR sectors:
OpenSBI, U-Boot, the boot-firmware DTB, the D0 loader, and their U-Boot/Group1
headers. D0 stayed stopped during controller access. The full Group0/M0
SHA-256 was identical before and after the update.

DFU_DETACH then caused a software POR without BOOT/RST button input. The
board returned through OpenSBI `v1.9-73-g6ad246a1` and U-Boot
`2026.10-g62c9805d8d57-dirty`. The M0 runtime occupied 12672 SRAM bytes;
its post-reboot CRC32 matched `a1241e4b`. USB re-enumerated and reported D0
running with zero DMA errors. Standalone DETACH and a later post-check reboot
also returned to that normal boot path.

These observations establish the recorded Flash write/readback and warm
software-reboot sequence. The [NOR chapter](/storage/flash/) gives the physical
offsets and the [SD chapter](/storage/sd-card/#recorded-file-reads) records the
separate card-read sessions.

## Native Linux SDH

The 2026-10-23 follow-up used RAM-loaded U-Boot, Linux and a device tree.
Linux reported `7.3.0-ga804c5742bff-dirty #18`, with local forwarding-IRQ,
SDH and read-only PLL providers. The initramfs root and SBI `hvc0` console
kept the SD filesystem unmounted and did not exercise a native Linux UART
driver. Linux initialized both forwarding banks itself; these successful
runs did not depend on a bootloader clearing the latches first.

Five fresh 4 KiB reads and the preserved file CRCs accompanied the following
interrupt counts:

| SDH parent | PLIC 81 parent count | MCU 17 child count | Card clock reported by software |
| --- | --- | --- | --- |
| 96 MHz | 363 → 952 | 362 → 951 | 3,000,000 Hz |
| 95 MHz | 78 → 667 | 77 → 666 | 2,968,750 Hz |

No IRQ disabling, Oops or panic was reported in those checks. Failed earlier
initialization variants could still read correct data through spurious-IRQ
recovery polling; the successful checks therefore required native IRQ
counter progress as well as matching data.

The [PIO and SDMA tests](/storage/sd-card/#native-linux-pio-and-sdma) wrote
only known `testfile` data at LBA 32833 through 32840. Guard blocks were
32832 and 32841. Each length of 1, 3 and 8 blocks was restored and checked.
For SDMA, a separately reprobed PIO host read each pattern before restoring
the original bytes with PIO. The eight-block original SHA-256 remained:

```text
d956e40fda74c92b4219b67ec4f322685a73bde8afe2586ee6d5992047ab11a8
```

After the write tests, Linux and the unchanged installed U-Boot both
returned the original `testfile` and `hello.txt` CRCs. Selected shared PLL
and USB register words matched their saved values, and native M0 USB
continued to answer. The installed NOR and FAT boot files were not replaced;
31 saved M0/D0 source and firmware-artifact hashes matched their baseline.

### Recorded image identity

The reference compressed Linux image was 5,243,771 bytes with SHA-256:

```text
3ce8e4c163cb7d9ee28efc70d98ea3641bb01a2f69a132f545dd9a27dcf13c8f
```

Its source base was Linux `a804c5742bff224d4cb4d25dd383554d598be32b`
with the local drivers described above. The RAM U-Boot base was
`62c9805d8d57cad407f0295879cc9a6182da464a`; these base revisions alone
do not identify the local changes. The final S-mode diagnostic binary had
SHA-256 `82ca4dba4511d7f78646e9ef246de804e4f29fcaf310af55e0f26e9d50cfa08b`.

## SDH initialization-clock follow-up

The later 2026-10-23 comparison isolated the missing initialization-clock
operation. [The SD chapter](/storage/sd-card/#initial-clocks-and-first-cmd8)
gives every control condition and the first-attempt counts. Its native Linux
control and fixed diagnostic images use the same current Linux base and
platform support; the fixed image adds initialization-clock generation.

| Native Linux observation | Before initialization-clock change | After change |
| --- | --- | --- |
| First CMD8 | Status `0x00018000`, no response | Status `0x00000001`, R7 `0x000001aa` |
| Later card discovery | Succeeded after later identification commands | Succeeded from the first CMD8 |
| Five fresh block reads and file CRCs | Matched | Matched |
| First CMD8 after native driver re-probe | Not tested in this control | Five of five re-probes succeeded |

In the fixed native read check, PLIC 81 increased 299 → 881 and MCU 17
increased 298 → 880. SD write counters stayed zero, and no kernel crash or
IRQ disabling was reported. All five persistent SD files matched their saved
sizes/CRCs when the board returned to the earlier native `ttyS3` RAM shell.
All 1,728 saved firmware/build baseline hashes remained unchanged.

The native diagnostic image identities are:

Control image: 5,245,959 bytes, SHA-256:

```text
da5d7d536dbb8057ff460c28bab5022c6bac0b8bd7b42f05ed4d9e8314acd2da
```

Fixed image with temporary command logging: 5,245,948 bytes, SHA-256:

```text
f45cdcb68ecffa1450d4b6f31e5237a17e592e36b44eb7a01d334398675902c5
```

The clean SDH glue source SHA-256 is
`39d9d3e9a87864af80875de0279a1486d88093fb411f93974a16d329fa65e82e`.
Diagnostic logging and SD-only probe restrictions are excluded from that
source change. The clean image also builds with `W=1`; the runtime
first-command evidence above comes from the diagnostic image. Physical cold
power-up, another card and socket waveforms remain separate checks. This
result addresses the tested CMD8 obstacle, not complete platform acceptance.

## Native Linux UART

A separate native UART session used the current Linux base, a local
`bflb,uart` driver, PLIC source 20 and fixed clocks describing the firmware
handoff. Linux `ttyS3` supplied the console; the `hvc0` device was excluded
from that test kernel. Its compressed image was 5,038,195 bytes, SHA-256:

```text
e0873278bb0ba90294b46a356bedd1ee27f5d21d2ed5cf98f95dee23f682d47a
```

The driver source SHA-256 was
`0388179b65ccfb9c94e72c3c0733df5a527dbe448d2e082c46bc6a20af880c76`.
The [UART chapter](/uart/overview/#native-linux-rxtx-and-reopen) records
paced binary transfers at three rates, userspace TX, idle/resume and 100
actual last-close/open cycles. Those lifecycle tests used `console=ttynull`
with the shell on native `ttyS3`; an attached kernel console would prevent
the intended last-close shutdown.

The [unpaced RX failure](/uart/overview/#continuous-rx-limit) remains a
verified limitation: at 1 Mbps, a 255-byte transfer returned 102 bytes with
a hardware FIFO overrun. Successful paced tests and builds do not establish
continuous high-speed RX acceptance or upstream readiness. The test images
were RAM-only and the existing persistent boot files were preserved.

## RAM boot and 115200 default console

The 2026-10-24 firmware update enabled the M0 UART0 log channel at 115200
and set the D0 UART3 console defaults to 115200. M0, firmware DTB and
U-Boot/header changes were written over the native OTG DFU service with
backup and independent readback of 85 NOR sectors. OpenSBI itself was not
reflashed; it read the updated firmware DTB. After software POR, readable
OpenSBI and U-Boot output appeared on UART3 at 115200, while the separate
UART0 channel reported M0 startup, D0 release and USB DFU readiness.

The subsequent [development RAM boot](/storage/ram-boot/) sent a new Linux
kernel, Linux DTB and initramfs over UART3. Its input clock remained 40 MHz;
only the bit period temporarily selected 2 Mbps for transfer. Both host and
board returned to 115200 before the kernel started. Complete-file RAM CRCs
matched and the five existing SD file sizes/CRCs remained unchanged.

Linux `7.3.0-g0b106a97216e-dirty` selected native `ttyS3` through DT stdout
alone, emitted fresh printk and `/dev/console` markers, and passed the
20-printk/64-TTY mixed-output check at 115200. The live UART3 clock-provider
rate was 40 MHz. Independent postflight readback found `0x015a015a` in both
UART3 and M0 UART0 bit-period registers; the Linux terminal reported 115200
and M0 USB DFU remained available. The updated Linux was tested from RAM;
the installed SD Linux files were not replaced. These are serial/readback
observations, not an independent clock-pin measurement.

## Interpreting the results

The [initial RTC observation](/clocks/rtc/#observed-enable-behavior) establishes
that the counter advanced after its clock configuration changed. The
[2026-10-23 follow-up](/clocks/rtc/#divider-and-reset-follow-up) adds measured
cycle/TIME ratios and approximate host calibration. Neither is a clock-pin
waveform measurement.

The [SDH observation](/interrupts/m0ic/#sdh-delivery-path) establishes one
peripheral route through the forwarding controller and PLIC. The
[native UART RX observation](/uart/overview/#observed-rx-interrupt-delivery)
establishes source 20 separately. Polling UART output alone exercises
neither of those interrupt paths.

Logs, diagnostic sources, image hashes and the checking history are retained in
the local laboratory archive. The [notation guide](/references/notation/)
describes the register tables and address conventions used throughout this manual.
