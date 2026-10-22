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

The established M1s console configuration uses `UART_BIT_PRD = 0x00130013`, a divisor of 20 in each direction, and a source described as 40 MHz. The console exchanges commands at 2 Mbps. This verifies the usable serial setting; it is not an independent oscillator-frequency calibration.

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

## Console initialization

The working polling console uses eight data bits, one stop bit and no parity. It initializes the FIFOs, masks interrupts for polling operation, sets the bit periods and enables the TX/RX logic. Clock and pad routing are configured before this peripheral sequence.

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
