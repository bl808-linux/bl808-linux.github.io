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

## SDH initialization clocks

The M1s Dock follow-up requires an explicit initialization-clock sequence
before the first CMD0/CMD8 pair. The SDK names the generator controls
`GEN_PAD_CLK_CNT` (bits 31:24) and `GEN_PAD_CLK_ON` (bit 6) at SDH offset
`0x100`. Miscellaneous completion at offset `0x10e` has a status-enable bit
and a W1C completion bit. These vendor extensions are defined in the
[pinned Bouffalo SDK header](https://github.com/bouffalolab/bl_iot_sdk/blob/edcf613f073d3ef7d2f290d7c285b69be35da75b/components/platform/soc/bl808/bl808_std/BL808_BSP_Driver/Peripherals/sdh_reg.h);
the standard SDHCI register descriptions alone do not supply these fields.

After the host clock, voltage and pad setup:

1. Mask the miscellaneous interrupt signal while polling, enable its status
   and acknowledge stale completion.
2. Program a count of 80 and start the pad-clock generator.
3. Wait for fresh completion with a bounded timeout, acknowledge it and
   restore the saved miscellaneous controls.
4. Send CMD0, then CMD8 with argument `0x1aa`.

The tested Linux change runs the generator on `MMC_POWER_UP` to
`MMC_POWER_ON` through the existing `platform_send_init_74_clocks` hook.
The upstream
[PXAv3 driver](https://github.com/torvalds/linux/blob/a804c5742bff224d4cb4d25dd383554d598be32b/drivers/mmc/host/sdhci-pxav3.c)
also uses that hook for an explicit 74-clock initialization operation; that
is a software precedent, not proof of identical BL808 silicon internals.

The [controlled CMD8 comparison](/storage/sd-card/#initial-clocks-and-first-cmd8)
records 1-clock and no-trigger failures, 74/80-clock successes and native
Linux verification. These are programmed counts and controller completion
observations, rather than measured socket waveforms. Clock-enable readback
and elapsed software delay alone did not establish initialization clocks
under the tested warm-POR conditions.

## Reset domains

Chip, MCU, multimedia, peripheral and core resets have different scopes. A D0-core reset and a multimedia-peripheral reset affect different targets. Use the specific register control for the intended target rather than treating every reset as a complete return to the same chip state.

### Observed SDH peripheral reset

On 2026-10-23, a RAM diagnostic asserted and deasserted GLB
`0x20000540` bit 22. The SDH argument, interrupt-enable and clock-control
registers returned to zero after previously written test signatures.
The checked SDH module/bus clock and UART controls retained their saved
values, and the diagnostic returned to U-Boot with its writable
configuration restored.

This establishes the reset action on those controller registers in that
board session. It does not establish a reset-domain inventory or the
retention and synchronization behavior of every SDH or SoC register.
