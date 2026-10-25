---
title: "RAM boot for development"
description: "Load Linux over UART at a temporary 2 Mbps, restore the 115200 console, and boot with a 40 MHz UART3 input clock."
---

For kernel, driver and device-tree development, the M1s Dock can receive new
Linux images from the PC directly into PSRAM and boot them through U-Boot.
The recorded workflow loads the kernel, Linux DTB and initramfs without
replacing the SD boot files or NOR firmware. Linux runs on the real D0 core;
the initramfs supplies its temporary root filesystem in RAM.

## Console and transfer settings

The boot firmware initializes D0's UART3 input clock to **40 MHz**. The
default console is **115200 8N1** through OpenSBI, U-Boot and the tested
Rust native Linux UART driver. The 40 MHz figure is the UART3 peripheral
input clock, not D0's CPU frequency.

| Phase | UART3 input clock | UART baud | Bit-period register |
| --- | --- | --- | --- |
| OpenSBI and normal U-Boot prompt | 40 MHz | 115200 | `0x015a015a` |
| PC-to-RAM image transfer | 40 MHz | 2000000 | `0x00130013` |
| U-Boot handoff and Linux native console | 40 MHz | 115200 | `0x015a015a` |

The host changes **only the bit-period setting** to select 2 Mbps during
file transfer, changes its own serial-port baud to match, and checks the
register readback. After the last file, it restores 115200 on both ends and
checks the register again **before booting Linux**. This leaves the 40 MHz
UART3 input unchanged and does not save a U-Boot environment.

UART3 uses GPIO16 TX / GPIO17 RX and the UART USB connector, observed as
`/dev/ttyUSB0` on this board. USB device numbering can vary. M0 has a separate
UART0 log channel on GPIO14/15 at 115200, observed as `/dev/ttyUSB1`.
The native **USB OTG** connector carries M0 DFU for storage updates; this
RAM image transfer uses the UART connection.

## Transfer and boot sequence

```text
PC: Image.gz + Linux DTB + initramfs
                 |
       UART3, temporarily 2 Mbps
                 |
       Small receiver running in PSRAM
                 |
       Verified image buffers in PSRAM
                 |
       Restore UART3 to 115200
                 |
       U-Boot decompresses and boots Linux
```

1. Start at the normal U-Boot prompt at 115200. Check its DRAM map and
   reservations so the receive buffers, decompressed kernel and U-Boot do
   not overlap. The tested firmware has a working RTC/time counter.
2. Temporarily select 2 Mbps at the board and host. Use U-Boot's `loads`
   command to install a small S-record receiver in PSRAM, verify its CRC,
   and execute it with `go`.
3. Send the compressed kernel, Linux DTB and initramfs as binary files. The
   receiver accepts up to 4 KiB per block, returns that block's CRC32, and
   waits for the PC's acknowledgement before receiving the next block.
   U-Boot also checks the complete RAM buffer's CRC32 against the PC file.
4. Restore and read back the 115200 setting. Decompress the kernel with
   `unzip`, select the loaded Linux DTB with `fdt addr`, and run `booti`
   with the kernel address, initramfs address and exact byte size, and DTB
   address. The tested DT supplies `stdout-path` for the native console.

The tested RAM map is:

| Buffer | Address | Reserved capacity |
| --- | --- | --- |
| Small UART receiver and its control words | `0x50100000` | 64 KiB |
| Decompressed Linux kernel | `0x50200000` | 24 MiB |
| Compressed `Image.gz` | `0x52000000` | 6 MiB |
| Linux DTB | `0x52600000` | 64 KiB |
| Initramfs | `0x52700000` | 2 MiB |

These addresses apply to the checked 64 MiB M1s Dock boot configuration.
The loader validates capacities and live U-Boot reservations before upload;
another image or memory layout needs the same checks.

Block acknowledgements make this a controlled upload. A successful 2 Mbps
upload does not establish unrestricted continuous UART reception or full
duplex operation at 2 Mbps.

## Verified board result

The 2026-10-24 run used Linux `7.3.0-g0b106a97216e-dirty`, the Rust UART3
driver and RX DMA, with local changes to the board stdout setting and default
native-console baud. Its compressed kernel was 3,916,123 bytes, the Linux
DTB 3,124 bytes and the initramfs 1,839,259 bytes. All three RAM buffers
passed complete-file CRC checks.

| Check | Observed result |
| --- | --- |
| Firmware console | OpenSBI and U-Boot output readable at 115200 after the firmware update |
| Native Linux selection | DT `stdout-path` selected `ttyS3` as the sole registered console; command line was `rdinit=/init`, without `console=` or SBI earlycon |
| Kernel and console output | A fresh printk marker appeared on the UART before dmesg readback; `/dev/console` output also appeared |
| Mixed output at 115200 | All 20 ordered printk records and 64 TTY records were recovered without missing or corrupted data |
| Clock and baud readback | Linux reported a 40 MHz UART3 baud clock; UART3 bit-period register read `0x015a015a`; the terminal reported 115200 |
| Other boot services | Timer interrupts progressed and M0 USB DFU still answered |
| Persistent storage | The five existing SD test/boot files retained their expected sizes and CRCs; the RAM boot made no SD or NOR writes |

The compressed kernel SHA-256 is:

```text
457c6502b3a1dfa28b6e75dd2d1b010e20b9144f0a8e1b659b992ebbef40e2cc
```

The source base alone does not identify the local baud changes. The archived
source patch SHA-256 is
`131778497685843f2c1296460d867a4999b9baedafa787ae95eefdcae0996b2c`.
The image/config/source manifests, raw UART captures and independent register
checks are retained with the board records.

## Development use and persistence

This workflow lets successive kernels and DTBs run against the same installed
firmware and SD contents. A reset starts the installed firmware again; the
RAM-only Linux image is not installed as the next persistent boot choice.
The recorded tests used an initramfs root and no mounted SD filesystem.
Final installation requires updating the intended
[SD Linux boot files](/storage/sd-card/) separately.

See the [UART baud calculation](/uart/overview/#baud-generation),
[boot and storage roles](/storage/overview/) and
[board observation](/references/observations/#ram-boot-and-115200-default-console)
for the surrounding boot contract.
