---
title: "Clock tree"
description: "Clock sources, multimedia and MCU clock paths, dividers and gates."
---

A peripheral's clock is a path: **source → selector → divider → gate → consumer**. The CPU clock, a timer counter clock, a peripheral module clock and its bus-interface clock are separate signals even when they originate at the same PLL.

<figure class="diagram">
<svg viewBox="0 0 780 390" role="img" aria-labelledby="clock-title clock-desc"><title id="clock-title">BL808 clock paths used by D0, its time counter and UART3</title><desc id="clock-desc">RC32M or XTAL feed MM_XCLK. MM_XCLK and a PLL path feed the D0 root selector. The root passes through the CPU divider to D0, and then through the RTC divider and enable to the time counter. UART3 selects MM_XCLK, a mux PLL branch, or MM_BCLK1X before its own divider and enable.</desc><defs><marker id="arrow-c" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="currentColor" /></marker></defs><g class="line" marker-end="url(#arrow-c)"><path d="M135 62H190"/><path d="M135 112H165V75H190"/><path d="M300 70H350V140H390"/><path d="M300 170H390"/><path d="M500 155H550"/><path d="M660 155H695V250H590"/><path d="M470 250H410"/><path d="M245 95V330H350"/><path d="M300 250H325V330H350"/><path d="M460 330H530"/><path d="M640 330H690"/></g><g text-anchor="middle" font-size="14"><rect class="node" x="25" y="42" width="110" height="40" rx="5"/><text x="80" y="67">XTAL</text><rect class="node" x="25" y="92" width="110" height="40" rx="5"/><text x="80" y="117">RC32M</text><rect class="node" x="190" y="45" width="110" height="50" rx="5"/><text x="245" y="75">MM_XCLK</text><rect class="node" x="190" y="145" width="110" height="50" rx="5"/><text x="245" y="175">PLL path</text><rect class="accent-node" x="390" y="130" width="110" height="50" rx="5"/><text x="445" y="160">Root mux</text><rect class="node" x="550" y="130" width="110" height="50" rx="5"/><text x="605" y="160">CPU divider</text><text x="715" y="205" font-weight="600">D0</text><rect class="accent-node" x="470" y="225" width="120" height="50" rx="5"/><text x="530" y="247">RTC divider</text><text x="530" y="264" font-size="12">+ enable</text><rect class="node" x="300" y="225" width="110" height="50" rx="5"/><text x="355" y="255">time counter</text><rect class="node" x="190" y="225" width="110" height="50" rx="5"/><text x="245" y="247">PLL / bus</text><text x="245" y="264" font-size="12">UART parents</text><rect class="accent-node" x="350" y="305" width="110" height="50" rx="5"/><text x="405" y="335">UART mux</text><rect class="node" x="530" y="305" width="110" height="50" rx="5"/><text x="585" y="327">UART divider</text><text x="585" y="344" font-size="12">+ enable</text><text x="724" y="335" font-weight="600">UART3</text></g></svg>
<figcaption>Logical clock connectivity. The diagram shows paths, not measured clock rates or physical wire placement.</figcaption>
</figure>

## Control domains

| Domain | Controls | Consumers |
| --- | --- | --- |
| [HBN / PDS](/clocks/hbn-pds/) | XCLK and MCU root/PLL parent selection | MCU root and UART parent paths |
| [GLB](/clocks/glb/) | MCU dividers, SDH module clock and bus gates | MCU buses and MCU-side peripherals |
| [MM_GLB](/clocks/mm-glb/) | D0 root/PLL selection, multimedia bus and UART dividers | C906, MM buses, UART3 |
| [MM_MISC CPU_RTC](/clocks/rtc/) | C906 counter divider, enable and reset | `time` CSR and timer-event timing |

## Reading a rate

For the divider fields documented here, the divisor is the encoded value plus one:

```text
f_out = f_parent / (DIV + 1)
```

A disabled gate prevents delivery of that clock. Bus and module gates may both be required. The SDH host additionally divides its module clock before driving the card clock; the UART bit-period register adds another divider after its source clock.

Names such as `MM_MUXPLL_320M` identify clock branches. A clock-tree entry is not a frequency measurement. The reference describes the selectors and divider arithmetic without assigning an observed absolute rate to a PLL.

## Clock control and device trees

A `clock-frequency` property or `/cpus/timebase-frequency` describes the rate expected by software. It does not enable a clock or program a divider. Initialization must establish the hardware state before a consumer relies on that property.

The C906 time counter provides a concrete example: the counter clock can be disabled while OpenSBI advertises TIME and Linux registers its clocksource. See the [RTC clock controls](/clocks/rtc/#observed-enable-behavior).
