---
title: "Reading the reference"
description: "Register conventions, access semantics and address notation."
---

## Addresses and sizes

Hexadecimal CPU addresses use `0x` prefixes. An interval `[start, end)` includes its lower bound and excludes its upper bound. Its size is `end - start`. KiB and MiB mean powers of 1024.

A physical Flash offset is explicitly labeled as such. A CPU XIP address includes the active mapping and core view. Aliases describe views of one storage resource and are not counted as additional capacity.

## Register entries

Each entry gives the register block base, byte offset, absolute address and register width. Field tables give bit ranges, access types and operational descriptions. Entries may cover selected fields in a larger register; unshown bit ranges are not thereby declared reserved or writable.

Runtime register values are reported with their boot and measurement context. A readback after initialization is not a hardware reset value.

| Access | Meaning |
| --- | --- |
| RO | Read-only status or data interface; reads can still have documented side effects |
| RW | Read/write control |
| WO | Write-only interface |
| W1C | Write one to clear the selected condition |
| W1P | Write one to request a pulse or action |

Do not use a generic read-modify-write operation on a W1C register. Reading a FIFO data port consumes data. Reading PLIC claim/complete claims a source. Access type and side effects must both be considered.

## Bit diagrams and decoder

Bit diagrams put the most significant bit on the left. A field's diagram segment links to its table row; hover or focus shows its full name and range. Empty segments mean bits not covered by that entry. The table remains the text reference on narrow screens and for assistive technology.

The optional value decoder extracts the documented fields from a supplied 32-bit hexadecimal or decimal value. It runs entirely in the browser and never accesses hardware. A decoded number alone does not establish a hardware state or measurement.

## Clocks and interrupts

A clock branch name is an identifier. A rate computed from a divider requires a known parent rate. A rate property in a device tree does not initialize the clock hardware.

CPU cause numbers, peripheral interrupt names, MCU forwarding indices, PLIC source IDs and Linux virtual IRQs are separate namespaces. The [interrupt topology](/interrupts/overview/) gives the mapping contexts used in this reference.
