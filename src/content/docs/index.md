---
title: "BL808 Reference Manual"
description: "Clock, interrupt and address-space reference for BL808 software developers."
---

<div class="eyebrow">Hardware / Software interface</div>
<p class="overview-lead">Understand the clock path. Follow the interrupt. Know which address the core sees.</p>

This reference describes the BL808 interfaces used to bring up firmware and operating systems. Start with a subsystem's functional description, then follow the register definitions and source references. Board observations identify the Sipeed M1s Dock and the software context in which they were recorded.

<div class="chapter-grid">
<a href="/clocks/overview/"><small>01 / SYSTEM CONTROL</small><strong>Clocks &amp; reset →</strong><span>Trace sources, selectors, dividers and gates through to the CPU, timer and UART.</span></a>
<a href="/interrupts/overview/"><small>02 / INTERRUPT DELIVERY</small><strong>Interrupts →</strong><span>Follow local timer events and peripheral requests through their different delivery paths.</span></a>
<a href="/address-space/memory-map/"><small>03 / ADDRESS SPACE</small><strong>Memory map →</strong><span>Locate register blocks, SRAM, PSRAM and XIP. Distinguish addresses from storage offsets.</span></a>
<a href="/uart/overview/"><small>04 / PERIPHERAL INTERFACE</small><strong>UART →</strong><span>Connect the source clock and pads to the FIFO, baud generator and interrupt controls.</span></a>
</div>

## The system at a glance

| Block | Interface | Role |
| --- | --- | --- |
| M0 / E907 | RV32 | MCU execution domain; the minimal loader releases D0 |
| D0 / C906 | RV64 | Application execution domain; M-mode firmware and S-mode operating system |
| LP / E902 | Low-power core | Separate low-power execution domain |
| GLB, HBN, PDS | MCU-side control registers | Clock selection, gating, reset and forwarding controls |
| MM_GLB, MM_MISC | Multimedia-side control registers | D0 clock control, boot state and C906 time-counter clock |
| PLIC | External interrupt controller | Per-source priority and per-context delivery |
| CLINT | Core-local interrupt block | Machine software and timer interrupt interfaces |

## How to use this reference

A clock name identifies a path through hardware. A register value selects that path; it does not measure its output. An interrupt source ID identifies an input to a controller; it is not a Linux virtual IRQ number. An address identifies a location in a particular address space; two aliases need not be two memories.

Each register entry links to its definition. The [notation guide](/references/notation/) defines access types, address intervals and reset-value conventions. [Sources and revisions](/references/sources/) identifies the manuals and code used for this edition.

## Board context

The board observations in this edition use the Sipeed M1s Dock, with 64 MiB external PSRAM and 16 MiB SPI NOR. The D0 console is UART3 on GPIO16/17, connected to the dock's `/dev/ttyUSB0` channel at 2 Mbps. These are board and boot-configuration facts, not a statement that every BL808 design uses the same memory population or pins.

The public reference contains established definitions and verified behavior. Laboratory notes and unresolved investigations are maintained separately from this site.
