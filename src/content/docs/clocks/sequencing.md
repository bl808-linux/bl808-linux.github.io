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

## C906 counter clock

The vendor `CPU_Set_MTimer_CLK` sequence is:

1. Read the CPU_RTC control word and clear the clock-enable bit.
2. Update the divider field while preserving the other fields.
3. Set or clear the enable bit according to the requested state.

`CPU_Reset_MTimer` asserts and then clears the counter-reset bit. This is a counter operation, separate from resetting the C906 core. See [CPU_RTC](/clocks/rtc/#cpu-rtc).

## D0 and BCLK2X divider change

SDK `GLB_Set_DSP_System_CLK_Div` saves the root selections, switches to the RC32M/XCLK path, updates the dividers, sets `BCLK2X_DIV_ACT_PULSE`, waits for `BCLK2X_PROT_DONE`, and restores the source selections. The implementation includes a bounded wait and returns an error when completion is not observed.

This handshake is why a divider register write alone does not describe the complete SDK transition sequence. The corresponding [MM_GLB fields](/clocks/mm-glb/#mm-control) identify the request and status bits.

## UART3 source setup

The current console setup disables the MM UART source-divider path, selects XTAL for MM_XCLK, selects MM_XCLK as the UART parent, writes source-divider encoding zero and enables the path. GPIO16/17 are then configured for MM UART routing. The UART driver programs the baud generator and FIFOs afterward.

Changing the parent or divider of an active UART changes the relationship between its programmed bit period and the serial line. Clock setup, peripheral setup and pad routing must be read as one sequence.

## Reset domains

The vendor manual's Reset and Clock chapter distinguishes chip, MCU, multimedia, peripheral and core resets. A D0-core reset and a multimedia-peripheral reset have different scopes. Use the specific register definition for the intended target rather than treating every reset as a complete return to the same chip state.

Definitions and sequences are linked in [sources and revisions](/references/sources/#clock-definitions).
