---
title: "Initialization & reset"
description: "Established clock-update sequences and ownership across the boot handoff."
---

## Ownership across startup

| Stage | Clock and reset responsibility in the minimal M1s firmware path |
| --- | --- |
| M0 startup | Hold D0 in reset, control its gate, power and release the multimedia subsystem, then release D0 |
| D0 loader | Establish its execution state, initialize PSRAM, and set up UART clock and pads before OpenSBI |
| OpenSBI | Initialize its configured devices and provide M-mode services |
| S-mode software | Use the supplied device tree and the firmware interfaces |

The clock configuration must exist before a consumer uses the clock. A UART FDT driver does not necessarily initialize the SoC clock mux or the pads. An SBI TIME extension does not itself establish a running time source.

In the recorded 2026-10-21 power-on and board-RESET boots, the loader and
OpenSBI established a working UART console while CPU_RTC still read
`0x0000000a` and the `time` CSR read zero. The [paired readbacks](/references/observations/#power-on-and-board-reset-readbacks)
describe the state after the boot chain, rather than the chip's reset defaults.

## C906 counter clock

The counter-clock initialization sequence is:

1. Read the CPU_RTC control word and clear the clock-enable bit.
2. Update the divider field while preserving the other fields.
3. Set or clear the enable bit according to the requested state.

The counter-reset bit controls the counter separately from resetting the C906 core. See [CPU_RTC](/clocks/rtc/#cpu-rtc).

The counter must be advancing before software depends on timer-based delays.
The 2026-10-22 [U-Boot transfer observation](/clocks/rtc/#u-boot-delay-dependency)
demonstrated this during polling UART reception: `loads` waited in its
completion delay with a stopped counter, then completed after the tested
CPU_RTC setup was applied. A responsive command prompt alone did not establish
that the delay clock was running.

## D0 and BCLK2X divider change

The divider-update sequence saves the root selections, switches to the RC32M/XCLK path, updates the dividers, sets `BCLK2X_DIV_ACT_PULSE`, waits for `BCLK2X_PROT_DONE`, and restores the source selections. Completion waits must be bounded so a failed transition can be reported.

This handshake is why a divider register write alone does not describe the complete transition sequence. The corresponding [MM_GLB fields](/clocks/mm-glb/#mm-control) identify the request and status bits.

## UART3 source setup

The current console setup disables the MM UART source-divider path, selects XTAL for MM_XCLK, selects MM_XCLK as the UART parent, writes source-divider encoding zero and enables the path. GPIO16/17 are then configured for MM UART routing. The UART driver programs the baud generator and FIFOs afterward.

Changing the parent or divider of an active UART changes the relationship between its programmed bit period and the serial line. Clock setup, peripheral setup and pad routing must be read as one sequence.

## Reset domains

Chip, MCU, multimedia, peripheral and core resets have different scopes. A D0-core reset and a multimedia-peripheral reset affect different targets. Use the specific register control for the intended target rather than treating every reset as a complete return to the same chip state.
