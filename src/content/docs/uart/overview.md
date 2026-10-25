---
title: "UART functional description"
description: "UART3 source clock, pads, FIFO operation, baud generation and interrupt controls."
---

UART3 is the UART instance at `0x30002000`. Multimedia clock registers call it **MM UART0**. The M1s Dock's D0 console uses this instance on GPIO16/17.

## Dependencies

```text
XTAL / bus / PLL → MM_GLB UART selector → source divider + enable
                                                   ↓
GPIO routing ← UART TX/RX logic ← bit-period generator
                       ↕
                  TX / RX FIFOs
```

The preceding loader supplies the source clock and pin routing for the OpenSBI polling driver. The peripheral driver initializes the UART itself. A `clock-frequency` property describes the supplied source; it does not program the SoC clock controller.

## Baud generation

The TX and RX halves of `UART_BIT_PRD` contain independent bit-period values. For each direction:

```text
baud = UART source rate / (BIT_PRD + 1)
```

The current M1s Dock firmware initializes UART3 with a **40 MHz input clock**.
OpenSBI, U-Boot and the tested Rust native Linux console use **115200 8N1**.
This is the UART peripheral's input rate, separate from D0's CPU clock.

| Use | Requested baud | Divisor in each direction | `UART_BIT_PRD` |
| --- | --- | --- | --- |
| Default console and Linux boot | 115200 | 347 | `0x015a015a` |
| Temporary development file transfer | 2000000 | 20 | `0x00130013` |

At 40 MHz, divisor 347 gives approximately 115274 baud, the rounded hardware
setting for 115200. The [RAM boot loader](/storage/ram-boot/) changes only the
bit period for image transfer, then restores and reads back the 115200 setting
before starting Linux. The UART3 input remains 40 MHz throughout.

Earlier 2026-10-21/22 observations below used a 2 Mbps default console. The
new 115200 configuration was verified on 2026-10-24 with readable OpenSBI
and U-Boot output, native Linux printk and `/dev/console` output, and a live
Linux UART3 clock-provider rate of 40 MHz. These readbacks and serial tests
are not an independent oscillator-frequency calibration.

## Polling FIFOs

`TX_FIFO_CNT` reports free slots. Wait until this count is nonzero before writing a byte to `UART_FIFO_WDATA`. `RX_FIFO_CNT` reports received bytes. Read `UART_FIFO_RDATA` only when data is present; a read consumes a byte.

The FIFO counts are six-bit fields and the driver uses a 32-byte FIFO capacity. The data ports expose eight-bit payloads. The polling U-Boot driver uses byte accesses to those ports and 32-bit accesses to control registers.

Polling output works without UART interrupt delivery. An OpenSBI banner or U-Boot prompt therefore does not establish that the UART's PLIC route has been exercised.

## Interrupt controls

UART interrupt status, enable, mask and clear are separate controls. A mask bit of one suppresses the corresponding source. Only latched conditions with a defined W1C clear bit should be cleared through `UART_INT_CLEAR`; FIFO-ready conditions follow FIFO state.

| Bit | UART condition |
| --- | --- |
| 0 / 1 | TX end / RX end |
| 2 / 3 | TX FIFO ready / RX FIFO ready |
| 4 / 5 | RX timeout / parity error |
| 6 / 7 | TX FIFO error / RX FIFO error |
| 8 / 9 | RX LIN sync error / byte-count reached |
| 10 / 11 | RX auto-baud detection events |

UART3 is assigned D0 source ID 20 in the [source map](/interrupts/sources/). Peripheral status and FIFO polling remain different operations from PLIC claim/complete.

## Observed RX interrupt delivery

On 2026-10-23, a RAM-resident D0 S-mode diagnostic received actual host bytes
`A` and `B` through UART3. Each reception entered supervisor external cause
9 and claimed PLIC source 20 (`0x14`). Draining the RX FIFO and managing the
interrupt mask allowed the second delivery.

```text
UART3 RX → D0 PLIC source 20 → supervisor external cause 9
```

This path goes directly to the PLIC; it does not use the MCU forwarding
controller exercised by SDH. Simultaneous UART/SDH tests also confirmed
[PLIC priority arbitration](/interrupts/plic/#observed-priority-arbitration).

These diagnostic RX tests establish the peripheral route. The earlier
Linux storage sessions used SBI `hvc0`; the separate native Linux UART
follow-up below exercises the UART driver itself.

## Native Linux RX/TX and reopen

This section records the earlier 2026-10-23 driver and its limits. The current
115200 Rust native-console boot is recorded in
[RAM boot verification](/storage/ram-boot/#verified-board-result).

The 2026-10-23 follow-up used a local `bflb,uart` driver on current Linux
base `a804c5742bff224d4cb4d25dd383554d598be32b`. The RAM DT supplied
firmware-handoff fixed APB and baud clocks and PLIC source 20. Native
`/dev/ttyS3` RX and userspace TX advanced the driver's counters. A separate
boot used `console=ttynull` with a userspace shell on `ttyS3`, allowing real
last-close shutdown and reopen checks without an attached kernel console.

| Check | Recorded result |
| --- | --- |
| Paced binary RX and userspace TX | 63 comparisons across 115200, 1 Mbps and 2 Mbps passed |
| Payload coverage | 21 lengths per rate, 1 to 32,768 bytes, including FIFO boundaries; 55,759 bytes in each direction per rate |
| Drain, idle and resume | `tcdrain` completed; IRQ counters stayed unchanged during each two-second idle interval and input resumed |
| Actual last close/open | 100 cycles passed; the UART IRQ disappeared while closed and I/O worked after reopen |

Host-to-board RX used 16-byte bursts separated by 1 ms. Board-to-host TX
had no host pacing. RX/TX counters advanced from 1,236/2,757 to
168,619/176,000 with zero recorded parity, framing, hardware-overrun and
software-buffer-overrun counts in the paced lifecycle run. Successful
paced reception does not establish continuous reception at the selected
baud rate.

### Continuous RX limit

An unpaced 1 Mbps RX test failed on a 255-byte payload: only 102 bytes were
received and the data comparison failed. The hardware FIFO-overrun counter
increased to one; parity and software-buffer-overrun counts stayed zero.
Continuous high-speed RX acceptance therefore remains incomplete. Resolving
SDH CMD8 does not resolve this UART limitation.

The initial support and validation cover two-wire BL808 UART3 only. Real
clock/reset-provider integration, injected parity/framing/break errors,
hardware flow control, DMA, runtime module loading and other SoCs were not
validated. Built-in-console and module builds, binding/example checks and
strict checkpatch passed, but a module build is not a module-loading test.
The [board observation](/references/observations/#native-linux-uart)
records the image and driver identities.

## Console initialization

The working polling console uses eight data bits, one stop bit and no parity. It initializes the FIFOs, masks interrupts for polling operation, sets the bit periods and enables the TX/RX logic. Clock and pad routing are configured before this peripheral sequence.

## Normal-boot file reception

UART communication is available at the normal U-Boot prompt. Its `loads`
command receives S-records over the console connection and places their data
at the addresses encoded in those records. ROM download mode is a separate
receiver and was not used for this operation.

On 2026-10-22, the M1s Dock running U-Boot `2026.10-g62c9805d8d57-dirty`
received a PC file over the 2 Mbps console connection:

| Item | Observed result |
| --- | --- |
| Reception | `loads`, S3 data records with an S7 terminator |
| Destination | PSRAM `[0x51220000, 0x51220400)` |
| Reported size | `0x400`, 1,024 bytes |
| PC file CRC32 | `b70b4c26` |
| Board RAM CRC32 | `b70b4c26` |
| End state | Completion summary and working U-Boot prompt |

The [RTC counter was initialized first](/clocks/rtc/#u-boot-delay-dependency)
because the receiver's completion delay requires timer progress. The original
CPU_RTC control word was restored after verification, and `version` answered
again. The received data remained in RAM; the run performed no NOR writes.
This establishes that recorded 1 KiB S-record transfer. The later
[image-sized RAM boot](/storage/ram-boot/) uses S-records to install a small
receiver, then transfers binary images with block and whole-file CRC checks.

## M1s Dock boot readback

The paired 2026-10-21 power-on and board-RESET sessions read the following
values at the U-Boot prompt while exchanging console commands at 2 Mbps:

| Register | Address | Readback in both sessions |
| --- | --- | --- |
| UTX_CONFIG | `0x30002000` | `0x00000f05` |
| URX_CONFIG | `0x30002004` | `0x00000701` |
| UART_BIT_PRD | `0x30002008` | `0x00130013` |

The [MM_GLB readbacks](/clocks/mm-glb/#m1s-dock-boot-readback) record the source
selector and divider settings in the same sessions. These are operational
readbacks under the [recorded boot configuration](/references/observations/#power-on-and-board-reset-readbacks).

Continue to the [register reference](/uart/registers/) for offsets, fields and access types.
