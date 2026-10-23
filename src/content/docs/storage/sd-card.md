---
title: "SD card & Linux files"
description: "Operating-system file roles, SD host ownership and verified polling, IRQ, PIO and SDMA behavior."
---

The SD card is the operating-system medium in the M1s Dock storage layout.
It holds Linux and its filesystems; OpenSBI and U-Boot remain in the
[NOR boot chain](/storage/flash/). Kernel maintenance therefore changes SD files
rather than replacing board firmware.

## Operating-system contents

| SD contents | Consumer | Role |
| --- | --- | --- |
| Versioned kernel image | U-Boot, then the CPU | Linux executable loaded into PSRAM |
| Linux DTB | Linux, passed by U-Boot | Hardware description selected with the kernel |
| Initramfs, when used | Linux | Initial userspace and early root-filesystem setup |
| Boot configuration | U-Boot | Kernel, DTB, initramfs and command-line selection |
| Root filesystem | Linux | OS packages, configuration and user files |
| `/lib/modules/<version>/` | Linux | Modules matching the selected kernel |

A versioned file layout keeps kernel generations separate:

```text
/boot/
  vmlinuz-<version>
  initrd.img-<version>          (when used)
  dtbs/<version>/<board>.dtb
/lib/modules/<version>/
```

These are paths in the OS installation, not raw card offsets. A separate FAT
boot partition can expose the boot files to U-Boot while Linux mounts its root
filesystem from another partition. The kernel image's format, the boot-file
paths and the boot configuration must agree with the installed U-Boot build.

When changing kernels, keep the matching Linux DTB and modules together, and
retain the previous generation's files and boot selection. The boot-firmware
DTB in NOR has a different consumer and update boundary; see
[two device-tree roles](/storage/overview/#keep-the-two-device-trees-distinct).

## SDH and pad setup

The SD host controller occupies `[0x20060000, 0x20061000)`. The board's SDH pad
configuration uses GPIO0–5. In the recorded U-Boot card-read sessions, selecting
the SDH function with pull-ups allowed card identification and repeatable FAT
file reads. Increasing drive strength without the pull-ups did not establish
the same result.

A configured source clock and a requested card-bus mode are different from a
measured wire frequency. In the 2026-10-20 U-Boot session, the card identified
as SD High Speed 50 MHz; the controller source/divider settings corresponded
to a nominal 48 MHz bus. The later native Linux tests below used a one-bit
bus at substantially lower register-derived card clocks.

## Polling and interrupt delivery

The U-Boot MMC stack used polling for card commands and file reads. A separate
D0 supervisor diagnostic established the interrupt route:

```text
SDH → MCU forwarding source 17 → D0 PLIC source 81 → supervisor external trap
```

The forwarding block does not require an M0 CPU interrupt handler to pass this
request to D0. Source 17, PLIC ID 81 and a Linux virtual IRQ are separate
identifiers. See the [SDH delivery path](/interrupts/m0ic/#sdh-delivery-path).

Boot-time U-Boot reads and runtime Linux storage access use different drivers.
The Linux kernel needs its own SDH, interrupt and filesystem support to access
the root filesystem on the card after the handoff.

## Recorded file reads

The 2026-10-20 M1s Dock session used U-Boot
`2023.04-rc2-g15b4a6348b9-dirty`, a DOS-partitioned card and a FAT32 partition
starting at sector 2048. Each file was read twice into PSRAM and checked against
an independently recorded host CRC:

| File | Bytes | CRC32 | Matching reads |
| --- | --- | --- | --- |
| `testfile` | 131072 | `7e8e43c2` | 2 |
| `hello.txt` | 55 | `bdb1a907` | 2 |

The read buffers were `0x51000000` and `0x51040000` in that session. Buffer
addresses belong to the running image's allocation map; check live reservations
before using a load address. The [U-Boot memory observation](/address-space/core-views/#observed-u-boot-allocation)
explains the distinction between board memory capacity and available buffers.

## Native Linux PIO and SDMA

On 2026-10-23, the M1s Dock booted a RAM-loaded Linux
`7.3.0-ga804c5742bff-dirty` with local SDH, forwarding-IRQ and clock drivers.
The root filesystem was an initramfs and no SD filesystem was mounted during
the raw-block write tests. The installed NOR and existing SD boot files
were preserved.

The existing `testfile` supplied a known eight-block data extent. Originals
and the immediately adjacent blocks were backed up to the host before
writing. Each tested length of 1, 3 and 8 blocks underwent pattern write,
fresh direct read, original restoration and fresh original/neighbor checks.
FAT, directory and partition-table sectors were not written.

| Transfer mode | SDH module parent | Verification |
| --- | --- | --- |
| PIO | 96 MHz | All three lengths matched and originals/neighbors were preserved |
| SDMA | 96 MHz | All three lengths matched, including an independent PIO read before PIO restoration |
| SDMA | 95 MHz | Same independent read and restoration checks passed |

Before DMA writes, five fresh direct reads and the 128 KiB file CRC passed.
The transfer-mode register showed `0x0022/0x0032` for PIO and
`0x0023/0x0033` for SDMA during actual requests. Host control selected SDMA
(`0x0f04`); the result was not inferred solely from the probe message.
Both parent and child IRQ counters advanced during the I/O. Subsequent
Linux and unchanged-U-Boot checks retained the original file CRCs above.

The kernel used explicit noncoherent DMA configuration and its enabled
T-Head cache-maintenance support. The tested SDHCI configuration selected
SDMA, even though the capability word advertised ADMA2 as well. These results
cover the recorded one-bit transfers and lengths; ADMA, 64-bit DMA, broad
cache/boundary stress, four-bit operation and high-speed electrical timing
were not validated by these tests.

The [board observation](/references/observations/#native-linux-sdh) records
IRQ counts and data-preservation evidence. The
[GLB description](/clocks/glb/#recorded-sdh-parent-rates) gives the programmed
parents and the resulting card-clock calculations.
