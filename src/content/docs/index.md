---
title: "BL808 Reference Manual"
description: "Clock, interrupt and address-space reference for BL808 software developers."
---

<div class="eyebrow">Hardware / Software interface</div>
<p class="overview-lead">Understand the clock path. Follow the interrupt. Know which address the core sees.</p>

This reference describes the BL808 interfaces used to bring up firmware and operating systems. Start with a subsystem's functional description, then follow its register entries. Board observations identify the Sipeed M1s Dock and the software context in which they were recorded.

<aside class="vendor-manuals" aria-label="Official vendor manuals">
<strong>Official Bouffalo Lab manuals (English)</strong>
<p><a href="/vendor/bl808/BL808_DS/en/">Datasheet 1.2</a> · <a href="/vendor/bl808/BL808_RM/en/">Reference Manual 1.3</a> · <a href="/vendor/bl808/">All vendor manuals →</a></p>
</aside>

<div class="chapter-grid">
<a href="/clocks/overview/"><small>01 / SYSTEM CONTROL</small><strong>Clocks &amp; reset →</strong><span>Trace sources, selectors, dividers and gates through to the CPU, timer and UART.</span></a>
<a href="/interrupts/overview/"><small>02 / INTERRUPT DELIVERY</small><strong>Interrupts →</strong><span>Follow local timer events and peripheral requests through their different delivery paths.</span></a>
<a href="/address-space/memory-map/"><small>03 / ADDRESS SPACE</small><strong>Memory map →</strong><span>Locate register blocks, SRAM, PSRAM and XIP. Distinguish addresses from storage offsets.</span></a>
<a href="/uart/overview/"><small>04 / PERIPHERAL INTERFACE</small><strong>UART →</strong><span>Connect the source clock and pads to the FIFO, baud generator and interrupt controls.</span></a>
<a href="/storage/overview/"><small>05 / BOOT &amp; STORAGE</small><strong>Flash &amp; SD →</strong><span>Keep OpenSBI and U-Boot in NOR, Linux on SD, and execution buffers in RAM.</span></a>
</div>

Latest board verification: [SDH initial clocks and first CMD8](/storage/sd-card/#initial-clocks-and-first-cmd8), and [native Linux UART RX/TX, reopen and receive limits](/uart/overview/#native-linux-rxtx-and-reopen). See [Board observations](/references/observations/) for the recorded software and image identities.

## The system at a glance

| Block | Interface | Role |
| --- | --- | --- |
| M0 / E907 | RV32 | MCU execution domain; releases D0 and services USB firmware updates from SRAM |
| D0 / C906 | RV64 | Application execution domain; M-mode firmware and S-mode operating system |
| LP / E902 | Low-power core | Separate low-power execution domain |
| GLB, HBN, PDS | MCU-side control registers | Clock selection, gating, reset and forwarding controls |
| MM_GLB, MM_MISC | Multimedia-side control registers | D0 clock control, boot state and C906 time-counter clock |
| PLIC | External interrupt controller | Per-source priority and per-context delivery |
| CLINT | Core-local interrupt block | Machine software and timer interrupt interfaces |

## How to use this reference

A clock name identifies a path through hardware. A register value selects that path; it does not measure its output. An interrupt source ID identifies an input to a controller; it is not a Linux virtual IRQ number. An address identifies a location in a particular address space; two aliases need not be two memories.

Each register entry gives its address, bit fields and access types. The [notation guide](/references/notation/) explains the tables and address intervals. [Board observations](/references/observations/) records the runtime results and their software context.

## Board context

The board observations in this edition use the Sipeed M1s Dock, with 64 MiB external PSRAM and 16 MiB SPI NOR. The current D0 console is UART3 on GPIO16/17, connected to the dock's `/dev/ttyUSB0` channel at **115200 8N1**, with a **40 MHz UART3 input clock**. OpenSBI, U-Boot and the tested Linux native console use that baud rate. USB device numbering can vary. These are board and boot-configuration facts, not a statement that every BL808 design uses the same memory population or pins.

For [development RAM boots](/storage/ram-boot/), the host temporarily selects
**2 Mbps for file transfer**, restores **115200 before Linux starts**, and
keeps the UART3 input clock at 40 MHz throughout. New kernels can be tested
without replacing the SD boot files. Earlier dated observations retain their
original 2 Mbps console settings.

The public reference contains established definitions and verified behavior. Laboratory notes and unresolved investigations are maintained separately from this site.
