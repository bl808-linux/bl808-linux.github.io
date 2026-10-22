---
title: "Sources & revisions"
description: "Primary manuals, source definitions and provenance of the BL808 reference."
---

This edition is based on vendor register definitions, the RISC-V interfaces implemented by the software stack, and established M1s Dock observations. Only supported definitions and verified behavior are included. Local laboratory notes and unresolved investigations are outside the published site.

## Vendor manual

[Bouffalo Lab BL808 Reference Manual, English v1.3](https://raw.githubusercontent.com/bouffalolab/bl_docs/main/BL808_RM/en/BL808_RM_en_1.3.pdf) provides the SoC overview, address map, interrupt assignments, Reset and Clock chapter, and UART description.

The reference uses the manual's structure to locate primary definitions. It does not reproduce the manual's diagrams or present old project notes as a replacement specification.

## Memory and register definitions

The vendor SDK's [register headers](https://github.com/bouffalolab/bl808_linux/tree/main/bl_mcu_sdk_bl808/drivers/bl808_driver/regs) establish register offsets, bit positions, access types and the reset metadata shown in register entries. Each entry links to its header and source location.

| Header | Used for |
| --- | --- |
| `bl808.h` | Peripheral bases, memory windows and core-specific IRQ assignments |
| `glb_reg.h` | GLB clocks, SDH gates and MCU forwarding controls |
| `hbn_reg.h`, `pds_reg.h` | Root-clock and PLL-parent selection |
| `mm_glb_reg.h` | D0 and multimedia clock controls |
| `mm_misc_reg.h` | C906 time-counter controls |
| `uart_reg.h` | UART configuration, interrupt and FIFO fields |

## Clock definitions

The vendor [bl808_clock.c](https://github.com/bouffalolab/bl808_linux/blob/main/bl_mcu_sdk_bl808/drivers/bl808_driver/std_drv/src/bl808_clock.c) defines clock-source selection and divisor calculations. [bl808_glb.c](https://github.com/bouffalolab/bl808_linux/blob/main/bl_mcu_sdk_bl808/drivers/bl808_driver/std_drv/src/bl808_glb.c) defines the corresponding clock and reset programming sequences.

Relevant functions include `CPU_Set_MTimer_CLK`, `CPU_Get_MTimer_Source_Clock`, `CPU_Get_MTimer_Clock`, and `GLB_Set_DSP_System_CLK_Div`.

## Interrupt definitions

- [RISC-V PLIC specification](https://github.com/riscv/riscv-plic-spec/blob/master/riscv-plic.adoc): priority, enable, threshold and claim/complete operation.
- [OpenSBI PLIC implementation](https://github.com/riscv-software-src/opensbi/blob/6ad246a1494807ee91e36ffcf60e4c30bb309d45/lib/utils/irqchip/plic.c): register layout and T-HEAD supervisor-access delegation.
- [OpenSBI T-HEAD timer match](https://github.com/riscv-software-src/opensbi/blob/6ad246a1494807ee91e36ffcf60e4c30bb309d45/lib/utils/timer/fdt_timer_mtimer.c): the C900 CLINT timer quirk.
- [Linux PLIC binding](https://github.com/bl808-linux/linux/blob/a804c5742bff224d4cb4d25dd383554d598be32b/Documentation/devicetree/bindings/interrupt-controller/sifive%2Cplic-1.0.0.yaml): T-HEAD interrupt cells and context connections.
- [Linux RISC-V timer driver](https://github.com/bl808-linux/linux/blob/a804c5742bff224d4cb4d25dd383554d598be32b/drivers/clocksource/timer-riscv.c): time reads, SBI deadlines and supervisor timer dispatch.

## Established board observations

| Date | Board / software context | Established result |
| --- | --- | --- |
| 2026-10-20 | M1s Dock, generic OpenSBI and S-mode U-Boot diagnostic | Repeated SDH command/forced events reached supervisor external cause 9 with PLIC claim 81 and MCU source bit 17 |
| 2026-10-20 | M1s Dock, S-mode timer diagnostic | Three SBI timer requests produced three supervisor timer interrupts |
| 2026-10-21 | M1s Dock, firmware `2f31e1c`, OpenSBI `6ad246a1` with UART patch, U-Boot `62c9805d` with board/UART changes, Linux `a804c574` | CPU_RTC clock enable changed fixed-zero time reads into advancing time reads; Linux completed the unaligned-access probe and reached rootfs mount |
| 2026-10-21 | M1s Dock, SRAM OpenSBI and S-mode U-Boot | UART3 console output and paced command input worked at 2 Mbps |

These identify particular board sessions. Register definitions and those runtime observations are distinguished throughout the reference. Logs, diagnostic sources and hashes are retained in the local laboratory archive.

## Editorial basis

The earlier m1sdock documents were reviewed together with its SDH IRQ, SoC diagnostic and UART studies. The vendor SDK boot path and the standalone SRAM OpenSBI path were reconciled rather than merged into one timeline. Addresses, memory allocation and software handoff are stated with their applicable context.

The publication format takes inspiration from [OpenTitan's UART register reference](https://opentitan.org/book/hw/ip/uart/doc/registers.html), [OpenTitan's memory map](https://opentitan.org/book/hw/top_earlgrey/doc/memory_map.html) and the [RP2040 datasheet](https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf). Diagrams and explanatory text here are specific to BL808.
