---
title: "Interrupt topology"
description: "Local and external interrupt delivery on the BL808 D0 core."
---

D0 receives **core-local interrupts** and **external peripheral interrupts** through different paths. The PLIC is part of the external path; the timer event does not pass through it.

<figure class="diagram"><svg viewBox="0 0 780 290" role="img" aria-labelledby="irq-title irq-desc"><title id="irq-title">D0 interrupt delivery paths</title><desc id="irq-desc">A time counter and comparator cause a machine timer event managed by OpenSBI and delivered to the supervisor timer path. A multimedia peripheral goes to the PLIC. SDH goes through MCU forwarding to PLIC source 81. The PLIC supervisor context produces an external interrupt to D0.</desc><defs><marker id="arrow-i" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="currentColor"/></marker></defs><g class="line" marker-end="url(#arrow-i)"><path d="M190 50H260"/><path d="M400 50H470"/><path d="M610 50H670"/><path d="M190 155H470"/><path d="M190 235H260"/><path d="M400 235H440V170H470"/><path d="M610 160H670"/></g><g text-anchor="middle" font-size="14"><rect class="node" x="20" y="25" width="170" height="50" rx="5"/><text x="105" y="55">Counter + compare</text><rect class="accent-node" x="260" y="25" width="140" height="50" rx="5"/><text x="330" y="55">OpenSBI / MTIP</text><rect class="node" x="470" y="25" width="140" height="50" rx="5"/><text x="540" y="55">SBI timer / STIP</text><text x="718" y="55">D0 · cause 5</text><rect class="node" x="20" y="130" width="170" height="50" rx="5"/><text x="105" y="160">MM peripheral</text><rect class="node" x="20" y="210" width="170" height="50" rx="5"/><text x="105" y="240">SDH event</text><rect class="accent-node" x="260" y="210" width="140" height="50" rx="5"/><text x="330" y="233">MCU forwarding</text><text x="330" y="250" font-size="12">source 17</text><rect class="accent-node" x="470" y="130" width="140" height="60" rx="5"/><text x="540" y="155">PLIC</text><text x="540" y="174" font-size="12">S-mode context</text><text x="718" y="165">D0 · cause 9</text><text x="443" y="214" class="note">ID 81</text></g></svg><figcaption>Timer and external paths are independent. The SDH forwarding route shown here was observed on the M1s Dock.</figcaption></figure>

## Numbering domains

| Number | Meaning | Example |
| --- | --- | --- |
| CPU interrupt cause | Class of interrupt entering a hart | Supervisor timer 5; supervisor external 9 |
| Peripheral interrupt name | Name used to identify a peripheral request | UART3 |
| MCU forwarding source | Bit index in the forwarding controller | SDH is source 17 |
| PLIC source ID | Peripheral input claimed from the PLIC | SDH forwarding was claimed as 81 |
| Linux IRQ number | Kernel-assigned virtual IRQ | Assigned by Linux's IRQ domain mapping |

These values are not interchangeable. A shared numeric value in two columns does not establish that the two domains use the same numbering rule.

## Conditions for external delivery

The peripheral must signal its event, intermediate forwarding must permit it, the PLIC source must be enabled for the intended context, and its priority must exceed that context's threshold. The CPU must also enable its external-interrupt input and permit interrupts globally.

Acknowledgement belongs to each layer: clearing a peripheral event, clearing an intermediate forwarding latch and completing a PLIC claim are separate operations.

Continue with [CPU-local interrupts](/interrupts/local/), [PLIC](/interrupts/plic/), [M0IC forwarding](/interrupts/m0ic/) or the [source map](/interrupts/sources/).
