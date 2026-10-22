---
title: "CPU local / CLINT"
description: "C906 local interrupt causes, CLINT addresses and SBI timer delivery."
---

## Hart interrupt causes

For RV64, the high bit of `scause` identifies an interrupt. The low bits contain its cause number. `sstatus.SIE` is the supervisor global interrupt enable; `sie` and `sip` contain individual enable and pending bits.

| Cause / bit | Name | Privilege path |
| --- | --- | --- |
| 1 | Supervisor software | SSIP / SSIE |
| 3 | Machine software | MSIP / MSIE |
| 5 | Supervisor timer | STIP / STIE |
| 7 | Machine timer | MTIP / MTIE |
| 9 | Supervisor external | SEIP / SEIE |
| 11 | Machine external | MEIP / MEIE |

Thus `scause = 0x8000000000000005` is a supervisor timer interrupt; `0x8000000000000009` is a supervisor external interrupt. These are CPU causes, not PLIC source IDs.

## CLINT addresses

The D0 boot device tree describes `thead,c900-clint` at `0xe4000000`. The OpenSBI driver uses its MSWI interface and its MTIMECMP interface.

| Address | Interface | Role |
| --- | --- | --- |
| `0xe4000000` | Hart 0 MSIP | Machine software-interrupt request |
| `0xe4004000` | Hart 0 MTIMECMP | Machine timer compare |
| `time` CSR | Counter read | Current time value presented to the core |

The OpenSBI T-HEAD CLINT match uses the `clint_without_mtime` quirk. Its counter-read path uses the time CSR rather than a generic memory-mapped MTIME register. Do not derive a D0 MTIME read address solely from a generic SiFive CLINT layout.

## Observed S-mode access boundary

In the 2026-10-21 S-mode U-Boot session, `md.q 0xe400bff8 1` raised
`Load access fault`, with `TVAL = 0x00000000e400bff8`. The boot's OpenSBI
domain listing gave S/U no access to `[0xe4000000, 0xe400c000)`.
The U-Boot error path printed `reset not supported yet` and required a
physical board RESET.

That failed MMIO read is separate from the available `time` CSR and SBI TIME
interface. In the [paired boot readbacks](/references/observations/#power-on-and-board-reset-readbacks),
S-mode `time` reads returned zero while the counter clock was disabled.

## Timer delivery

In the documented S-mode path, Linux reads `time` to obtain the clocksource value and calls SBI TIME to set an event deadline. OpenSBI programs the machine timer and exposes the supervisor timer event. Linux enables `STIE` and dispatches its timer event handler on supervisor timer interrupts.

A running [counter clock](/clocks/rtc/) is required for both meaningful time reads and progressing deadlines. PLIC configuration is unrelated to this local timer path.

## Board observation

On 2026-10-20, a bounded S-mode RAM probe requested three SBI deadlines, each 10,000 counter ticks ahead. It observed three supervisor timer interrupts with cause `0x8000000000000005`; measured intervals were 10,423, 10,421 and 10,421 counter ticks including software overhead. The probe restored its supervisor context and returned to U-Boot.

These are counter-tick intervals in that boot configuration. No conversion to independently calibrated microseconds is made here.
